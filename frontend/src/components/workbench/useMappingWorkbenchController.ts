import { useCallback, useEffect, useMemo, useState } from "react"
import { Effect } from "effect"

import type { DemoScenario } from "@/components/workbench/DemoScenarioPanel"
import {
  SAMPLE_EDI_214,
  SAMPLE_EDI_856,
  SAMPLE_SOURCE_JSON,
  SAMPLE_SOURCE_XML,
  SAMPLE_TARGET_JSON,
  SAMPLE_TARGET_XML,
} from "@/components/workbench/constants"
import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import {
  createTemplateEffect,
  createTemplateVersionEffect,
  diffOutputEffect,
  generateNativeGraphDraftEffect,
  getMappingCapabilitiesEffect,
  getTemplateEffect,
  listTemplatesEffect,
  parseEffect,
  suggestMappingsEffect,
  transformEffect,
  validateEffect,
} from "@/lib/effect/api_effects"
import type {
  MappingRule,
  MappingSpec,
  MappingTemplate,
  MappingSuggestion,
  OutputDiffItem,
  OutputFormat,
  SourceFormat,
  TransformResponse,
} from "@/types/mapping"
import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import type { ValidationErrorItem } from "@/types/validation"

type AutoMapMode = "local" | "ai"
type AutoMapStatus =
  | "idle"
  | "local"
  | "ai-used"
  | "ai-unavailable"
  | "ai-fallback"
type NewMappingPromptState = {
  open: boolean
  pending: boolean
}
type RunMode = "saved-sample" | "override"
type MappingWorkbenchOptions = {
  sourceSchemas: SchemaArtifact[]
  targetSchemas: SchemaArtifact[]
}

export const demoScenarios: DemoScenario[] = [
  {
    id: "json-json",
    label: "JSON to JSON",
    description: "Shipment JSON to normalized JSON event output.",
    sourceFormat: "json",
    targetFormat: "json",
    source: SAMPLE_SOURCE_JSON,
    target: SAMPLE_TARGET_JSON,
    icon: "json",
  },
  {
    id: "xml-json",
    label: "XML to JSON",
    description:
      "Shipment XML canonicalized to JSON, then mapped to the JSON target.",
    sourceFormat: "xml",
    targetFormat: "json",
    source: SAMPLE_SOURCE_XML,
    target: SAMPLE_TARGET_JSON,
    icon: "xml",
  },
  {
    id: "json-xml",
    label: "JSON to XML",
    description: "Shipment JSON mapped into an XML ShipmentEvent document.",
    sourceFormat: "json",
    targetFormat: "xml",
    source: SAMPLE_SOURCE_JSON,
    target: SAMPLE_TARGET_XML,
    icon: "xml",
  },
  {
    id: "edi-214",
    label: "EDI 214",
    description: "Inbound 214 status update canonicalized before mapping.",
    sourceFormat: "edi_214",
    targetFormat: "json",
    source: SAMPLE_EDI_214,
    target: SAMPLE_TARGET_JSON,
    icon: "edi",
  },
  {
    id: "edi-856",
    label: "EDI 856",
    description: "Inbound 856 ASN canonicalized before mapping.",
    sourceFormat: "edi_856",
    targetFormat: "json",
    source: SAMPLE_EDI_856,
    target: SAMPLE_TARGET_JSON,
    icon: "edi",
  },
]

export function useMappingWorkbenchController(options: MappingWorkbenchOptions) {
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("json")
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("json")
  const [sourceInput, setSourceInput] = useState(SAMPLE_SOURCE_JSON)
  const [targetInput, setTargetInput] = useState(SAMPLE_TARGET_JSON)
  const [selectedSourceSchemaId, setSelectedSourceSchemaId] = useState("")
  const [selectedTargetSchemaId, setSelectedTargetSchemaId] = useState("")
  const [runMode, setRunMode] = useState<RunMode>("saved-sample")
  const [overrideSourceInput, setOverrideSourceInput] = useState("")
  const [sourceSchema, setSourceSchema] = useState<SchemaNode | null>(null)
  const [targetSchema, setTargetSchema] = useState<SchemaNode | null>(null)
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([])
  const [rules, setRules] = useState<MappingRule[]>([])
  const [activeMappingSpec, setActiveMappingSpec] = useState<MappingSpec | null>(
    null
  )
  const [nativeGraphText, setNativeGraphText] = useState("")
  const [nativeGraphUnresolvedPaths, setNativeGraphUnresolvedPaths] = useState<string[]>([])
  const [outputDiff, setOutputDiff] = useState<OutputDiffItem[]>([])
  const [advancedJsonata, setAdvancedJsonata] = useState("")
  const [transformResult, setTransformResult] =
    useState<TransformResponse | null>(null)
  const [validationErrors, setValidationErrors] = useState<
    ValidationErrorItem[]
  >([])
  const [providerErrors, setProviderErrors] = useState<string[]>([])
  const [usedAi, setUsedAi] = useState(false)
  const [autoMapMode, setAutoMapMode] = useState<AutoMapMode>("local")
  const [autoMapStatus, setAutoMapStatus] = useState<AutoMapStatus>("idle")
  const [aiMappingAvailable, setAiMappingAvailable] = useState(false)
  const [templates, setTemplates] = useState<MappingTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<MappingTemplate | null>(
    null
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("Shipment status map")
  const [templateDescription, setTemplateDescription] = useState("")
  const [activeScenarioId, setActiveScenarioId] = useState("json-json")
  const [issue, setIssue] = useState<FrontendIssue | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(
    "Loading templates"
  )
  const [newMappingPrompt, setNewMappingPrompt] =
    useState<NewMappingPromptState>({
      open: false,
      pending: false,
    })

  const selectedSourceSchema =
    options.sourceSchemas.find(
      (schema) => schema.schema_id === selectedSourceSchemaId
    ) ?? null
  const selectedTargetSchema =
    options.targetSchemas.find(
      (schema) => schema.schema_id === selectedTargetSchemaId
    ) ?? null
  const activeSourceSchema = selectedSourceSchema?.inferred_schema ?? sourceSchema
  const activeTargetSchema = selectedTargetSchema?.inferred_schema ?? targetSchema
  const activeSourceFormat = selectedSourceSchema?.format ?? sourceFormat
  const activeTargetFormat = selectedTargetSchema
    ? outputFormatForSchema(selectedTargetSchema)
    : targetFormat

  const readyForMapping = Boolean(activeSourceSchema && activeTargetSchema)
  const readyForTransform =
    readyForMapping && (rules.length > 0 || Boolean(activeMappingSpec))
  const readyForTemplateSave = Boolean(
    activeSourceSchema &&
      activeTargetSchema &&
      (rules.length > 0 || Boolean(activeMappingSpec))
  )

  const statusText = useMemo(() => {
    if (busyAction) return busyAction
    if (validationErrors.length > 0)
      return `${validationErrors.length} validation issue(s)`
    if (transformResult) return "Transformation complete"
    if (activeMappingSpec?.engine === "native_graph") return "Native graph loaded"
    if (rules.length > 0) return `${rules.length} editable rule(s)`
    if (readyForMapping) return "Schemas selected"
    return "Waiting for schemas"
  }, [
    busyAction,
    readyForMapping,
    rules.length,
    activeMappingSpec,
    transformResult,
    validationErrors.length,
  ])

  const autoMapStatusText = useMemo(() => {
    if (autoMapStatus === "local") return "Local suggestions"
    if (autoMapStatus === "ai-used") return "AI used"
    if (autoMapStatus === "ai-fallback") return "AI failed, local used"
    if (autoMapStatus === "ai-unavailable") return "AI unavailable, local used"
    return autoMapMode === "ai" ? "AI-assisted mode" : "Local mode"
  }, [autoMapMode, autoMapStatus])

  const clearRunResults = useCallback(() => {
    setTransformResult(null)
    setValidationErrors([])
    setOutputDiff([])
    setAutoMapStatus("idle")
  }, [])

  const clearMappingSuggestions = useCallback(() => {
    setSuggestions([])
    setProviderErrors([])
    setUsedAi(false)
  }, [])

  const clearDerivedResults = useCallback(() => {
    setSourceSchema(null)
    setTargetSchema(null)
    clearMappingSuggestions()
    clearRunResults()
  }, [clearMappingSuggestions, clearRunResults])

  const clearTargetDerivedResults = useCallback(() => {
    setTargetSchema(null)
    clearMappingSuggestions()
    clearRunResults()
  }, [clearMappingSuggestions, clearRunResults])

  const handleSourceInputChange = useCallback(
    (value: string) => {
      setSourceInput(value)
      clearDerivedResults()
    },
    [clearDerivedResults]
  )

  const handleSourceFormatChange = useCallback(
    (format: SourceFormat) => {
      setSourceFormat(format)
      clearDerivedResults()
    },
    [clearDerivedResults]
  )

  const handleTargetInputChange = useCallback(
    (value: string) => {
      setTargetInput(value)
      clearTargetDerivedResults()
    },
    [clearTargetDerivedResults]
  )

  const handleTargetFormatChange = useCallback(
    (format: OutputFormat) => {
      setTargetFormat(format)
      setTargetInput(format === "xml" ? SAMPLE_TARGET_XML : SAMPLE_TARGET_JSON)
      clearTargetDerivedResults()
    },
    [clearTargetDerivedResults]
  )

  useEffect(() => {
    if (selectedSourceSchemaId) return
    if (sourceSchema) return
    const firstSource = options.sourceSchemas.at(0)
    if (firstSource) selectSourceSchema(firstSource.schema_id)
  }, [options.sourceSchemas, selectedSourceSchemaId, sourceSchema])

  useEffect(() => {
    if (selectedTargetSchemaId) return
    if (targetSchema) return
    const firstTarget = options.targetSchemas.at(0)
    if (firstTarget) selectTargetSchema(firstTarget.schema_id)
  }, [options.targetSchemas, selectedTargetSchemaId, targetSchema])

  useEffect(() => {
    let cancelled = false

    void Promise.allSettled([
      Effect.runPromise(listTemplatesEffect()),
      Effect.runPromise(getMappingCapabilitiesEffect()),
    ]).then(([templatesResult, capabilitiesResult]) => {
      if (cancelled) return
      if (templatesResult.status === "fulfilled") {
        setTemplates(templatesResult.value.templates)
      } else {
        setIssue(issueFromUnknown(templatesResult.reason))
      }
      if (capabilitiesResult.status === "fulfilled") {
        setAiMappingAvailable(capabilitiesResult.value.ai_mapping_available)
        if (!capabilitiesResult.value.ai_mapping_available)
          setAutoMapMode("local")
      } else {
        setAiMappingAvailable(false)
        setAutoMapMode("local")
      }
      setBusyAction((current) =>
        current === "Loading templates" ? null : current
      )
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function parseAndInfer() {
    setBusyAction("Loading schemas")
    setIssue(null)
    try {
      await currentMappingInputs()
      setTransformResult(null)
      setValidationErrors([])
      setAutoMapStatus("idle")
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function autoMap() {
    setBusyAction("Generating mappings")
    setIssue(null)
    try {
      const parsed = await currentMappingInputs()
      const useAi = autoMapMode === "ai"
      const response = await Effect.runPromise(
        suggestMappingsEffect(parsed.sourceSchema, parsed.targetSchema, useAi)
      )
      setSuggestions(response.suggestions)
      setProviderErrors(response.provider_errors)
      setUsedAi(response.used_ai)
      setAutoMapStatus(
        statusForAutoMapResult(
          useAi,
          response.used_ai,
          response.provider_errors
        )
      )
      applyRules(response.suggestions.map(suggestionToRule))
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function runTransform() {
    setBusyAction("Running transformation")
    setIssue(null)
    try {
      const parsed = await currentMappingInputs()
      const validationSchema =
        activeTargetFormat === "json" ? parsed.targetSchema : null
      const rulesForTransform = rulesWithAdvancedJsonata()
      syncAdvancedJsonataFromRules(rulesForTransform)
      const response = await Effect.runPromise(
        transformEffect(
          parsed.sourceData,
          rulesForTransform,
          activeMappingSpec,
          activeTargetFormat,
          validationSchema
        )
      )
      setTransformResult(response)
      if (activeTargetFormat === "json") {
        const diff = await Effect.runPromise(
          diffOutputEffect(parsed.targetData, response.output)
        )
        setOutputDiff(diff.diffs)
      } else {
        setOutputDiff([])
      }
      const validation = await Effect.runPromise(
        validateEffect(
          parsed.sourceData,
          response.output,
          rulesForTransform,
          activeMappingSpec,
          validationSchema
        )
      )
      setValidationErrors([...response.validation_errors, ...validation.errors])
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function refreshTemplates() {
    setBusyAction((current) => current ?? "Loading templates")
    try {
      const response = await Effect.runPromise(listTemplatesEffect())
      setTemplates(response.templates)
      if (selectedTemplateId) {
        setActiveTemplate(
          response.templates.find(
            (template) => template.template_id === selectedTemplateId
          ) ?? null
        )
      }
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction((current) =>
        current === "Loading templates" ? null : current
      )
    }
  }

  async function saveTemplate() {
    if (!activeSourceSchema || !activeTargetSchema || !hasMappingSpecForSave()) return
    setBusyAction("Saving template")
    setIssue(null)
    try {
      const template = await Effect.runPromise(
        createTemplateEffect(templateRequest())
      )
      await applySavedTemplate(template)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function saveTemplateVersion() {
    if (
      !activeSourceSchema ||
      !activeTargetSchema ||
      !hasMappingSpecForSave() ||
      !selectedTemplateId
    )
      return
    setBusyAction("Saving version")
    setIssue(null)
    try {
      const template = await Effect.runPromise(
        createTemplateVersionEffect(selectedTemplateId, templateRequest())
      )
      await applySavedTemplate(template)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function loadTemplate(templateId: string, versionNumber?: number) {
    setBusyAction("Loading template")
    setIssue(null)
    try {
      const template = await Effect.runPromise(getTemplateEffect(templateId))
      const version =
        template.versions.find(
          (item) => item.version === (versionNumber ?? template.active_version)
        ) ?? template.versions.at(-1)
      if (!version) return

      setActiveTemplate(template)
      setSelectedTemplateId(template.template_id)
      setTemplateName(template.name)
      setTemplateDescription(template.description)
      setSourceFormat(version.source_format)
      setTargetFormat(version.target_format)
      setSelectedSourceSchemaId(version.source_schema_id ?? "")
      setSelectedTargetSchemaId(version.target_schema_id ?? "")
      if (version.sample_source_content)
        setSourceInput(version.sample_source_content)
      if (version.sample_target_content)
        setTargetInput(version.sample_target_content)
      setSourceSchema(version.source_schema_snapshot ?? null)
      setTargetSchema(version.target_schema_snapshot ?? null)
      const nativeSpec =
        version.mapping_spec.engine === "native_graph" ? version.mapping_spec : null
      setActiveMappingSpec(nativeSpec)
      setNativeGraphText(nativeSpec ? JSON.stringify(nativeSpec, null, 2) : "")
      setNativeGraphUnresolvedPaths([])
      applyRules(
        version.mapping_spec.rules,
        version.mapping_spec.full_jsonata_expression,
        { preserveMappingSpec: version.mapping_spec.engine === "native_graph" }
      )
      setValidationErrors(version.validation_rules)
      setTransformResult(null)
      setSuggestions([])
      setProviderErrors([])
      setUsedAi(false)
      setAutoMapStatus("idle")
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  function selectTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    const selected =
      templates.find((template) => template.template_id === templateId) ?? null
    setActiveTemplate(selected)
    if (selected) {
      setTemplateName(selected.name)
      setTemplateDescription(selected.description)
      if (selected.is_seeded) void loadTemplate(selected.template_id)
    }
  }

  function loadScenario(scenario: DemoScenario) {
    setActiveScenarioId(scenario.id)
    setSelectedSourceSchemaId("")
    setSelectedTargetSchemaId("")
    setSourceFormat(scenario.sourceFormat)
    setTargetFormat(scenario.targetFormat)
    setSourceInput(scenario.source)
    setTargetInput(scenario.target)
    setSourceSchema(null)
    setTargetSchema(null)
    setSuggestions([])
    setRules([])
    setActiveMappingSpec(null)
    setNativeGraphText("")
    setNativeGraphUnresolvedPaths([])
    setAdvancedJsonata("")
    setTransformResult(null)
    setValidationErrors([])
    setProviderErrors([])
    setUsedAi(false)
    setAutoMapStatus("idle")
    setIssue(null)
    setTemplateName(`${scenario.label} map`)
    setTemplateDescription(scenario.description)
  }

  async function startNewMapping() {
    if (!hasUnsavedMapping()) {
      resetToBlankMapping()
      return
    }
    setNewMappingPrompt({ open: true, pending: false })
  }

  function cancelNewMapping() {
    setNewMappingPrompt({ open: false, pending: false })
  }

  function discardAndStartNewMapping() {
    resetToBlankMapping()
    setNewMappingPrompt({ open: false, pending: false })
  }

  async function saveAndStartNewMapping() {
    if (
      !activeSourceSchema ||
      !activeTargetSchema ||
      !hasMappingSpecForSave() ||
      templateName.trim().length === 0
    ) {
      resetToBlankMapping()
      setNewMappingPrompt({ open: false, pending: false })
      return
    }

    setNewMappingPrompt({ open: true, pending: true })
    setBusyAction("Saving template")
    setIssue(null)
    try {
      const request = templateRequest()
      const template = await Effect.runPromise(
        selectedTemplateId
          ? createTemplateVersionEffect(selectedTemplateId, request)
          : createTemplateEffect(request)
      )
      await applySavedTemplate(template)
      resetToBlankMapping()
      setNewMappingPrompt({ open: false, pending: false })
    } catch (error) {
      setIssue(issueFromUnknown(error))
      setNewMappingPrompt({ open: true, pending: false })
    } finally {
      setBusyAction(null)
    }
  }

  async function currentMappingInputs() {
    const nextSourceSchema = selectedSourceSchema?.inferred_schema ?? sourceSchema
    const nextTargetSchema = selectedTargetSchema?.inferred_schema ?? targetSchema
    if (!nextSourceSchema || !nextTargetSchema) {
      throw new Error("Select a source schema and target schema before mapping.")
    }

    let sourceData: unknown
    if (runMode === "override" && selectedSourceSchema) {
      const parsedOverride = await Effect.runPromise(
        parseEffect(selectedSourceSchema.format, overrideSourceInput)
      )
      sourceData = parsedOverride.canonical
      setSourceInput(overrideSourceInput)
    } else if (selectedSourceSchema) {
      sourceData = selectedSourceSchema.canonical_sample
      setSourceInput(selectedSourceSchema.original_content)
    } else {
      const parsedSource = await Effect.runPromise(
        parseEffect(sourceFormat, sourceInput)
      )
      sourceData = parsedSource.canonical
    }

    if (selectedTargetSchema) {
      setTargetInput(selectedTargetSchema.original_content)
    }
    setSourceFormat(activeSourceFormat)
    setTargetFormat(activeTargetFormat)
    setSourceSchema(nextSourceSchema)
    setTargetSchema(nextTargetSchema)
    return {
      sourceData,
      targetData: await parseCurrentTargetData(),
      sourceSchema: nextSourceSchema,
      targetSchema: nextTargetSchema,
    }
  }

  async function parseCurrentTargetData() {
    if (selectedTargetSchema) {
      return selectedTargetSchema.canonical_sample
    }
    const parsedTarget = await Effect.runPromise(
      parseEffect(targetFormat, targetInput)
    )
    return parsedTarget.canonical
  }

  function templateRequest() {
    const mappingRules = rulesWithAdvancedJsonata()
    const mappingSpec =
      activeMappingSpec ??
      ({
        engine: "deterministic_rules",
        rules: mappingRules,
        full_jsonata_expression: advancedJsonata.trim() || null,
      } satisfies MappingSpec)
    return {
      name: templateName.trim(),
      description: templateDescription.trim(),
      source_format: activeSourceFormat,
      target_format: activeTargetFormat,
      source_schema_id: selectedSourceSchema?.schema_id ?? null,
      target_schema_id: selectedTargetSchema?.schema_id ?? null,
      source_schema_snapshot: activeSourceSchema,
      target_schema_snapshot: activeTargetSchema,
      mapping_spec: mappingSpec,
      validation_rules: validationErrors,
      sample_source_content: selectedSourceSchema?.original_content ?? sourceInput,
      sample_target_content: selectedTargetSchema?.original_content ?? targetInput,
    }
  }

  async function applySavedTemplate(template: MappingTemplate) {
    setActiveTemplate(template)
    setSelectedTemplateId(template.template_id)
    setTemplateName(template.name)
    setTemplateDescription(template.description)
    const response = await Effect.runPromise(listTemplatesEffect())
    setTemplates(response.templates)
  }

  function applyRules(
    nextRules: MappingRule[],
    jsonataExpression?: string | null,
    options?: { preserveMappingSpec?: boolean }
  ) {
    setRules(nextRules)
    if (!options?.preserveMappingSpec) {
      setActiveMappingSpec(null)
      setNativeGraphText("")
    }
    setAdvancedJsonata(
      jsonataExpression ?? jsonataExpressionForRules(nextRules)
    )
  }

  function updateRules(nextRules: MappingRule[]) {
    setRules(nextRules)
    setActiveMappingSpec(null)
    setNativeGraphText("")
    setNativeGraphUnresolvedPaths([])
    if (shouldSyncAdvancedJsonata()) {
      setAdvancedJsonata(jsonataExpressionForRules(nextRules))
    }
  }

  function updateNativeGraphText(value: string) {
    setNativeGraphText(value)
    clearRunResults()
  }

  function applyNativeGraphText() {
    const parsed = JSON.parse(nativeGraphText) as MappingSpec
    if (parsed.engine !== "native_graph" || !parsed.native_graph) {
      throw new Error("Native graph JSON must be a mapping spec with engine native_graph.")
    }
    setActiveMappingSpec(parsed)
    setRules(parsed.rules ?? [])
    setAdvancedJsonata("")
    setNativeGraphUnresolvedPaths([])
    clearRunResults()
  }

  async function generateNativeGraphDraft() {
    setBusyAction("Generating native graph draft")
    setIssue(null)
    try {
      const parsed = await currentMappingInputs()
      const response = await Effect.runPromise(
        generateNativeGraphDraftEffect(
          parsed.sourceData,
          parsed.targetData,
          parsed.sourceSchema,
          parsed.targetSchema,
          autoMapMode === "ai"
        )
      )
      setActiveMappingSpec(response.mapping_spec)
      setNativeGraphText(JSON.stringify(response.mapping_spec, null, 2))
      setNativeGraphUnresolvedPaths(response.unresolved_target_paths)
      setProviderErrors(response.provider_errors)
      setUsedAi(response.used_ai)
      setRules(response.mapping_spec.rules ?? [])
      setAdvancedJsonata("")
      clearRunResults()
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  function syncAdvancedJsonataFromRules(nextRules: MappingRule[]) {
    if (shouldSyncAdvancedJsonata()) {
      setAdvancedJsonata(jsonataExpressionForRules(nextRules))
    }
  }

  function shouldSyncAdvancedJsonata() {
    return (
      advancedJsonata.trim() === "" ||
      advancedJsonata === jsonataExpressionForRules(rules)
    )
  }

  function rulesWithAdvancedJsonata() {
    const expression = advancedJsonata.trim()
    if (!expression || rules.length !== 1 || rules[0]?.jsonata) {
      return rules
    }
    return [{ ...rules[0], jsonata: expression }]
  }

  function hasUnsavedMapping() {
    return (
      sourceInput.trim().length > 0 ||
      targetInput.trim().length > 0 ||
      rules.length > 0 ||
      Boolean(activeMappingSpec) ||
      nativeGraphText.trim().length > 0 ||
      advancedJsonata.trim().length > 0 ||
      Boolean(transformResult) ||
      validationErrors.length > 0
    )
  }

  function hasMappingSpecForSave() {
    return rules.length > 0 || Boolean(activeMappingSpec)
  }

  function resetToBlankMapping() {
    setSourceFormat("json")
    setTargetFormat("json")
    setSelectedSourceSchemaId("")
    setSelectedTargetSchemaId("")
    setRunMode("saved-sample")
    setOverrideSourceInput("")
    setSourceInput("")
    setTargetInput("")
    setSourceSchema(null)
    setTargetSchema(null)
    setSuggestions([])
    setRules([])
    setActiveMappingSpec(null)
    setNativeGraphText("")
    setNativeGraphUnresolvedPaths([])
    setAdvancedJsonata("")
    setTransformResult(null)
    setValidationErrors([])
    setProviderErrors([])
    setUsedAi(false)
    setAutoMapStatus("idle")
    setIssue(null)
    setActiveTemplate(null)
    setSelectedTemplateId("")
    setActiveScenarioId("")
    setTemplateName("Untitled mapping")
    setTemplateDescription("")
  }

  function selectSourceSchema(schemaId: string) {
    const schema =
      options.sourceSchemas.find((item) => item.schema_id === schemaId) ?? null
    setSelectedSourceSchemaId(schemaId)
    if (schema) {
      setSourceFormat(schema.format)
      setSourceInput(schema.original_content)
      setSourceSchema(schema.inferred_schema)
      setOverrideSourceInput(schema.original_content)
    } else {
      setSourceSchema(null)
    }
    clearMappingSuggestions()
    clearRunResults()
  }

  function selectTargetSchema(schemaId: string) {
    const schema =
      options.targetSchemas.find((item) => item.schema_id === schemaId) ?? null
    setSelectedTargetSchemaId(schemaId)
    if (schema) {
      setTargetFormat(outputFormatForSchema(schema))
      setTargetInput(schema.original_content)
      setTargetSchema(schema.inferred_schema)
    } else {
      setTargetSchema(null)
    }
    clearMappingSuggestions()
    clearRunResults()
  }

  return {
    sourceFormat,
    targetFormat,
    sourceInput,
    targetInput,
    sourceSchema,
    targetSchema,
    selectedSourceSchemaId,
    selectedTargetSchemaId,
    selectedSourceSchema,
    selectedTargetSchema,
    runMode,
    overrideSourceInput,
    suggestions,
    rules,
    activeMappingSpec,
    nativeGraphText,
    nativeGraphUnresolvedPaths,
    outputDiff,
    advancedJsonata,
    transformResult,
    validationErrors,
    providerErrors,
    usedAi,
    autoMapMode,
    aiMappingAvailable,
    templates,
    activeTemplate,
    selectedTemplateId,
    templateName,
    templateDescription,
    activeScenarioId,
    issue,
    busyAction,
    newMappingPrompt,
    readyForMapping,
    readyForTransform,
    readyForTemplateSave,
    statusText,
    autoMapStatusText,
    setAutoMapMode,
    setRunMode,
    setOverrideSourceInput,
    setTemplateName,
    setTemplateDescription,
    setRules: updateRules,
    setNativeGraphText: updateNativeGraphText,
    setAdvancedJsonata,
    handleSourceInputChange,
    handleSourceFormatChange,
    handleTargetInputChange,
    handleTargetFormatChange,
    selectSourceSchema,
    selectTargetSchema,
    parseAndInfer,
    autoMap,
    runTransform,
    applyNativeGraphText,
    generateNativeGraphDraft,
    refreshTemplates,
    saveTemplate,
    saveTemplateVersion,
    startNewMapping,
    cancelNewMapping,
    discardAndStartNewMapping,
    saveAndStartNewMapping,
    loadTemplate,
    selectTemplate,
    loadScenario,
  }
}

function jsonataExpressionForRules(rules: MappingRule[]) {
  const expressions = rules.flatMap((rule) =>
    rule.jsonata ? [rule.jsonata] : []
  )
  return expressions.length > 0 ? JSON.stringify(expressions, null, 2) : ""
}

function statusForAutoMapResult(
  requestedAi: boolean,
  usedAi: boolean,
  providerErrors: string[]
): AutoMapStatus {
  if (!requestedAi) return "local"
  if (usedAi) return "ai-used"
  return providerErrors.length > 0 ? "ai-fallback" : "ai-unavailable"
}

function suggestionToRule(suggestion: MappingSuggestion): MappingRule {
  return {
    id: suggestion.id,
    type: suggestion.type,
    source_path: suggestion.source_path,
    target_path: targetPathForRuntime(suggestion.target_path),
    required: suggestion.required,
    confidence: suggestion.confidence,
    jsonata: suggestion.jsonata,
  }
}

function targetPathForRuntime(path: string) {
  return path
    .replace("$.ShipmentEvent.", "$.")
    .replace("$.ShipmentEvent", "$")
    .replace("$.tracking.number", "$.tracking.number")
}

function outputFormatForSchema(schema: SchemaArtifact): OutputFormat {
  return schema.format === "xml" ? "xml" : "json"
}
