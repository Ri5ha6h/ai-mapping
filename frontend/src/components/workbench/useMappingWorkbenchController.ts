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
  generateScriptDraftEffect,
  getMappingCapabilitiesEffect,
  getTemplateEffect,
  inferSchemaEffect,
  listTemplatesEffect,
  parseEffect,
  suggestMappingsEffect,
  transformEffect,
  validateEffect,
} from "@/lib/effect/api_effects"
import type {
  MappingSpec,
  MappingSuggestion,
  MappingTemplate,
  OutputDiffItem,
  OutputFormat,
  SourceFormat,
  TransformResponse,
} from "@/types/mapping"
import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import type { ValidationErrorItem } from "@/types/validation"

type AutoMapMode = "local" | "ai"
type AutoMapStatus = "idle" | "local" | "ai-used" | "ai-unavailable" | "ai-fallback"
type RunMode = "saved-sample" | "override"
type NewMappingPromptState = { open: boolean; pending: boolean }
type MappingWorkbenchOptions = {
  sourceSchemas: SchemaArtifact[]
  targetSchemas: SchemaArtifact[]
}

const DEFAULT_SCRIPT = `function transform(source, helpers) {
  // source is the parsed input object. XML and EDI inputs arrive as canonical JSON.
  // helpers includes get, default, clean, regexReplace, parseNumber, formatDate,
  // lookup, countryCode, and omitEmpty.
  // Example: helpers.get(source, "$.customer.name", "")

  return {
    // Build the target JSON here.
  };
}`

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
    description: "Shipment XML canonicalized to JSON, then mapped to the JSON target.",
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
  const [script, setScript] = useState(DEFAULT_SCRIPT)
  const [draftExplanation, setDraftExplanation] = useState("")
  const [unresolvedTargetPaths, setUnresolvedTargetPaths] = useState<string[]>([])
  const [transformResult, setTransformResult] = useState<TransformResponse | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([])
  const [outputDiff, setOutputDiff] = useState<OutputDiffItem[]>([])
  const [providerErrors, setProviderErrors] = useState<string[]>([])
  const [usedAi, setUsedAi] = useState(false)
  const [autoMapMode, setAutoMapMode] = useState<AutoMapMode>("local")
  const [autoMapStatus, setAutoMapStatus] = useState<AutoMapStatus>("idle")
  const [aiMappingAvailable, setAiMappingAvailable] = useState(false)
  const [templates, setTemplates] = useState<MappingTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<MappingTemplate | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("Shipment transform")
  const [templateDescription, setTemplateDescription] = useState("")
  const [activeScenarioId, setActiveScenarioId] = useState("json-json")
  const [issue, setIssue] = useState<FrontendIssue | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>("Loading templates")
  const [newMappingPrompt, setNewMappingPrompt] = useState<NewMappingPromptState>({
    open: false,
    pending: false,
  })

  const selectedSourceSchema =
    options.sourceSchemas.find((schema) => schema.schema_id === selectedSourceSchemaId) ?? null
  const selectedTargetSchema =
    options.targetSchemas.find((schema) => schema.schema_id === selectedTargetSchemaId) ?? null
  const activeSourceSchema = selectedSourceSchema?.inferred_schema ?? sourceSchema
  const activeTargetSchema = selectedTargetSchema?.inferred_schema ?? targetSchema
  const activeSourceFormat = selectedSourceSchema?.format ?? sourceFormat
  const activeTargetFormat = selectedTargetSchema
    ? outputFormatForSchema(selectedTargetSchema)
    : targetFormat

  const readyForMapping = Boolean(activeSourceSchema && activeTargetSchema)
  const readyForTransform = readyForMapping && script.trim().length > 0
  const readyForTemplateSave = readyForTransform
  const sourceReference = selectedSourceSchema?.canonical_sample ?? parseReferenceSource(sourceInput)

  const mappingSpec = useMemo<MappingSpec>(
    () => ({ engine: "script_js", script_version: 1, script }),
    [script]
  )

  const statusText = useMemo(() => {
    if (busyAction) return busyAction
    if (validationErrors.length > 0) return `${validationErrors.length} validation issue(s)`
    if (outputDiff.length > 0) return `${outputDiff.length} output difference(s)`
    if (transformResult) return "Script run complete"
    if (readyForMapping) return "Ready to run script"
    return "Waiting for schemas"
  }, [busyAction, outputDiff.length, readyForMapping, transformResult, validationErrors.length])

  const autoMapStatusText = useMemo(() => {
    if (autoMapStatus === "local") return "Local field hints"
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
    void refreshTemplates()
    Effect.runPromise(getMappingCapabilitiesEffect()).then(
      (capabilities) => setAiMappingAvailable(capabilities.ai_mapping_available),
      () => setAiMappingAvailable(false)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function parseAndInfer() {
    setBusyAction("Inferring schemas")
    setIssue(null)
    try {
      const parsedSource = await Effect.runPromise(parseEffect(sourceFormat, sourceInput))
      const parsedTarget = await Effect.runPromise(parseEffect(targetFormat, targetInput))
      const [sourceResult, targetResult] = await Promise.all([
        Effect.runPromise(inferSchemaEffect(parsedSource.canonical)),
        Effect.runPromise(inferSchemaEffect(parsedTarget.canonical)),
      ])
      setSourceSchema(sourceResult.schema)
      setTargetSchema(targetResult.schema)
      clearMappingSuggestions()
      clearRunResults()
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function autoMap() {
    setBusyAction("Finding field hints")
    setIssue(null)
    try {
      const parsed = await currentMappingInputs()
      const useAi = autoMapMode === "ai"
      const response = await Effect.runPromise(
        suggestMappingsEffect(parsed.sourceSchema, parsed.targetSchema, useAi)
      )
      setSuggestions(response.suggestions)
      setUsedAi(response.used_ai)
      setProviderErrors(response.provider_errors)
      setAutoMapStatus(statusForAutoMapResult(useAi, response.used_ai, response.provider_errors))
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function generateScript() {
    setBusyAction("Generating script")
    setIssue(null)
    try {
      const parsed = await currentMappingInputs()
      const response = await Effect.runPromise(
        generateScriptDraftEffect(
          parsed.sourceData,
          parsed.targetData,
          parsed.sourceSchema,
          parsed.targetSchema,
          autoMapMode === "ai"
        )
      )
      setScript(response.mapping_spec.script)
      setDraftExplanation(response.explanation)
      setUnresolvedTargetPaths(response.unresolved_target_paths)
      setProviderErrors(response.provider_errors)
      setUsedAi(response.used_ai)
      clearRunResults()
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function runTransform() {
    setBusyAction("Running script")
    setIssue(null)
    try {
      const parsed = await currentMappingInputs()
      const validationSchema = activeTargetFormat === "json" ? parsed.targetSchema : null
      const response = await Effect.runPromise(
        transformEffect(parsed.sourceData, mappingSpec, activeTargetFormat, validationSchema)
      )
      setTransformResult(response)
      const validation = await Effect.runPromise(
        validateEffect(parsed.sourceData, response.output, mappingSpec, validationSchema)
      )
      setValidationErrors([...response.validation_errors, ...validation.errors])
      if (activeTargetFormat === "json") {
        const diff = await Effect.runPromise(diffOutputEffect(parsed.targetData, response.output))
        setOutputDiff(diff.diffs)
      } else {
        setOutputDiff([])
      }
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
          response.templates.find((template) => template.template_id === selectedTemplateId) ?? null
        )
      }
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction((current) => (current === "Loading templates" ? null : current))
    }
  }

  async function saveTemplate() {
    if (!readyForTemplateSave) return
    setBusyAction("Saving template")
    setIssue(null)
    try {
      const template = await Effect.runPromise(createTemplateEffect(templateRequest()))
      await applySavedTemplate(template)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function saveTemplateVersion() {
    if (!readyForTemplateSave || !selectedTemplateId) return
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
        template.versions.find((item) => item.version === (versionNumber ?? template.active_version)) ??
        template.versions.at(-1)
      if (!version) return

      setActiveTemplate(template)
      setSelectedTemplateId(template.template_id)
      setTemplateName(template.name)
      setTemplateDescription(template.description)
      setSourceFormat(version.source_format)
      setTargetFormat(version.target_format)
      if (version.source_schema_id) setSelectedSourceSchemaId(version.source_schema_id)
      if (version.target_schema_id) setSelectedTargetSchemaId(version.target_schema_id)
      if (version.sample_source_content) setSourceInput(version.sample_source_content)
      if (version.sample_target_content) setTargetInput(version.sample_target_content)
      setSourceSchema(version.source_schema_snapshot ?? null)
      setTargetSchema(version.target_schema_snapshot ?? null)
      setScript(version.mapping_spec.script || DEFAULT_SCRIPT)
      setValidationErrors(version.validation_rules)
      setTransformResult(null)
      setOutputDiff([])
      setDraftExplanation("")
      setUnresolvedTargetPaths([])
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
    const selected = templates.find((template) => template.template_id === templateId) ?? null
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
    setScript(DEFAULT_SCRIPT)
    setTransformResult(null)
    setValidationErrors([])
    setOutputDiff([])
    setProviderErrors([])
    setUsedAi(false)
    setAutoMapStatus("idle")
    setDraftExplanation("")
    setUnresolvedTargetPaths([])
    setIssue(null)
    setTemplateName(`${scenario.label} transform`)
    setTemplateDescription(scenario.description)
  }

  function updateScript(value: string) {
    setScript(value)
    clearRunResults()
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
    if (!readyForTemplateSave || templateName.trim().length === 0) {
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
      throw new Error("Select or infer a source and target schema before running a script.")
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
      const parsedSource = await Effect.runPromise(parseEffect(sourceFormat, sourceInput))
      sourceData = parsedSource.canonical
    }

    const targetData = await parseCurrentTargetData()
    if (selectedTargetSchema) setTargetInput(selectedTargetSchema.original_content)
    setSourceFormat(activeSourceFormat)
    setTargetFormat(activeTargetFormat)
    setSourceSchema(nextSourceSchema)
    setTargetSchema(nextTargetSchema)
    return {
      sourceData,
      targetData,
      sourceSchema: nextSourceSchema,
      targetSchema: nextTargetSchema,
    }
  }

  async function parseCurrentTargetData() {
    if (selectedTargetSchema) return selectedTargetSchema.canonical_sample
    const parsedTarget = await Effect.runPromise(parseEffect(targetFormat, targetInput))
    return parsedTarget.canonical
  }

  function templateRequest() {
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

  function hasUnsavedMapping() {
    return (
      sourceInput.trim().length > 0 ||
      targetInput.trim().length > 0 ||
      script.trim() !== DEFAULT_SCRIPT.trim() ||
      Boolean(transformResult) ||
      validationErrors.length > 0
    )
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
    setScript(DEFAULT_SCRIPT)
    setTransformResult(null)
    setValidationErrors([])
    setOutputDiff([])
    setProviderErrors([])
    setUsedAi(false)
    setAutoMapStatus("idle")
    setDraftExplanation("")
    setUnresolvedTargetPaths([])
    setIssue(null)
    setActiveTemplate(null)
    setSelectedTemplateId("")
    setActiveScenarioId("")
    setTemplateName("Untitled transform")
    setTemplateDescription("")
  }

  function selectSourceSchema(schemaId: string) {
    const schema = options.sourceSchemas.find((item) => item.schema_id === schemaId) ?? null
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
    const schema = options.targetSchemas.find((item) => item.schema_id === schemaId) ?? null
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
    sourceReference,
    selectedSourceSchemaId,
    selectedTargetSchemaId,
    selectedSourceSchema,
    selectedTargetSchema,
    runMode,
    overrideSourceInput,
    suggestions,
    script,
    draftExplanation,
    unresolvedTargetPaths,
    transformResult,
    validationErrors,
    outputDiff,
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
    setScript: updateScript,
    handleSourceInputChange,
    handleSourceFormatChange,
    handleTargetInputChange,
    handleTargetFormatChange,
    selectSourceSchema,
    selectTargetSchema,
    parseAndInfer,
    autoMap,
    generateScript,
    runTransform,
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

function statusForAutoMapResult(
  requestedAi: boolean,
  usedAi: boolean,
  providerErrors: string[]
): AutoMapStatus {
  if (!requestedAi) return "local"
  if (usedAi) return "ai-used"
  return providerErrors.length > 0 ? "ai-fallback" : "ai-unavailable"
}

function outputFormatForSchema(schema: SchemaArtifact): OutputFormat {
  return schema.format === "xml" ? "xml" : "json"
}

function parseReferenceSource(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}
