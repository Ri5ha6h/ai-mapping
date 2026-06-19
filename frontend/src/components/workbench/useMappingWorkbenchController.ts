import { useCallback, useEffect, useMemo, useState } from "react"
import { Effect } from "effect"

import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import {
  createTemplateEffect,
  createTemplateVersionEffect,
  diffOutputEffect,
  getTemplateEffect,
  listTemplatesEffect,
  transformEffect,
  validateEffect,
} from "@/lib/effect/api_effects"
import type { MappingTemplate, OutputDiffItem, TransformResponse } from "@/types/mapping"
import type { SchemaArtifact } from "@/types/schema"
import type { ValidationErrorItem } from "@/types/validation"
import { useMappingSetupController } from "./useMappingSetupController"
import {
  DEFAULT_SCRIPT,
  useScriptAuthoringController,
} from "./useScriptAuthoringController"

type NewMappingPromptState = { open: boolean; pending: boolean }
type MappingWorkbenchOptions = {
  sourceSchemas: SchemaArtifact[]
  targetSchemas: SchemaArtifact[]
}

export function useMappingWorkbenchController(options: MappingWorkbenchOptions) {
  const [transformResult, setTransformResult] = useState<TransformResponse | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([])
  const [outputDiff, setOutputDiff] = useState<OutputDiffItem[]>([])
  const [templates, setTemplates] = useState<MappingTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<MappingTemplate | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("Shipment transform")
  const [templateDescription, setTemplateDescription] = useState("")
  const [issue, setIssue] = useState<FrontendIssue | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>("Loading templates")
  const [newMappingPrompt, setNewMappingPrompt] = useState<NewMappingPromptState>({
    open: false,
    pending: false,
  })

  const clearRunResults = useCallback(() => {
    setTransformResult(null)
    setValidationErrors([])
    setOutputDiff([])
  }, [])

  const setup = useMappingSetupController({
    sourceSchemas: options.sourceSchemas,
    targetSchemas: options.targetSchemas,
    onSetupChanged: clearRunResults,
  })
  const authoring = useScriptAuthoringController({
    currentMappingInputs: setup.currentMappingInputs,
    clearRunResults,
  })

  const readyForTransform = setup.readyForMapping && authoring.script.trim().length > 0
  const readyForTemplateSave = readyForTransform

  const statusText = useMemo(() => {
    if (busyAction) return busyAction
    if (validationErrors.length > 0) return `${validationErrors.length} validation issue(s)`
    if (outputDiff.length > 0) return `${outputDiff.length} output difference(s)`
    if (transformResult) return "Script run complete"
    if (setup.readyForMapping) return "Ready to run script"
    return "Waiting for schemas"
  }, [busyAction, outputDiff.length, setup.readyForMapping, transformResult, validationErrors.length])

  const refreshTemplates = useCallback(async () => {
    setBusyAction((current) => current ?? "Loading templates")
    try {
      const response = await Effect.runPromise(listTemplatesEffect())
      setTemplates(response.templates)
      setActiveTemplate((current) => {
        if (!current) return current
        return response.templates.find((template) => template.template_id === current.template_id) ?? null
      })
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction((current) => (current === "Loading templates" ? null : current))
    }
  }, [])

  useEffect(() => {
    void refreshTemplates()
  }, [refreshTemplates])

  async function withBusy(label: string, action: () => Promise<void>) {
    setBusyAction(label)
    setIssue(null)
    try {
      await action()
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function parseAndInfer() {
    await withBusy("Inferring schemas", async () => {
      await setup.parseAndInfer()
      authoring.clearMappingSuggestions()
      authoring.setAutoMapStatus("idle")
    })
  }

  function selectSourceSchema(schemaId: string) {
    setup.selectSourceSchema(schemaId)
    authoring.clearMappingSuggestions()
    authoring.setAutoMapStatus("idle")
  }

  function selectTargetSchema(schemaId: string) {
    setup.selectTargetSchema(schemaId)
    authoring.clearMappingSuggestions()
    authoring.setAutoMapStatus("idle")
  }

  async function autoMap() {
    await withBusy("Finding field hints", authoring.autoMap)
  }

  async function generateScript() {
    await withBusy("Generating script", authoring.generateScript)
  }

  async function runTransform() {
    await withBusy("Running script", async () => {
      const parsed = await setup.currentMappingInputs()
      const validationSchema = setup.activeTargetFormat === "json" ? parsed.targetSchema : null
      const response = await Effect.runPromise(
        transformEffect(parsed.sourceData, authoring.mappingSpec, setup.activeTargetFormat, validationSchema)
      )
      setTransformResult(response)
      const validation = await Effect.runPromise(
        validateEffect(
          parsed.sourceData,
          response.output,
          authoring.mappingSpec,
          validationSchema,
          setup.activeTargetFormat
        )
      )
      setValidationErrors([...response.validation_errors, ...validation.errors])
      if (setup.activeTargetFormat === "json") {
        const diff = await Effect.runPromise(
          diffOutputEffect(parsed.targetData, response.output, setup.activeTargetFormat)
        )
        setOutputDiff(diff.diffs)
      } else {
        setOutputDiff([])
      }
    })
  }

  async function saveTemplate() {
    if (!readyForTemplateSave) return
    await withBusy("Saving template", async () => {
      const template = await Effect.runPromise(createTemplateEffect(templateRequest()))
      await applySavedTemplate(template)
    })
  }

  async function saveTemplateVersion() {
    if (!readyForTemplateSave || !selectedTemplateId) return
    await withBusy("Saving version", async () => {
      const template = await Effect.runPromise(
        createTemplateVersionEffect(selectedTemplateId, templateRequest())
      )
      await applySavedTemplate(template)
    })
  }

  async function loadTemplate(templateId: string, versionNumber?: number) {
    await withBusy("Loading template", async () => {
      const template = await Effect.runPromise(getTemplateEffect(templateId))
      const version =
        template.versions.find((item) => item.version === (versionNumber ?? template.active_version)) ??
        template.versions.at(-1)
      if (!version) return

      setActiveTemplate(template)
      setSelectedTemplateId(template.template_id)
      setTemplateName(template.name)
      setTemplateDescription(template.description)
      setup.setSourceFormat(version.source_format)
      setup.setTargetFormat(version.target_format)
      if (version.source_schema_id) setup.setSelectedSourceSchemaId(version.source_schema_id)
      if (version.target_schema_id) setup.setSelectedTargetSchemaId(version.target_schema_id)
      if (version.sample_source_content) setup.setSourceInput(version.sample_source_content)
      if (version.sample_target_content) setup.setTargetInput(version.sample_target_content)
      setup.setSourceSchema(version.source_schema_snapshot ?? null)
      setup.setTargetSchema(version.target_schema_snapshot ?? null)
      authoring.setScriptRaw(version.mapping_spec.script || DEFAULT_SCRIPT)
      setValidationErrors(version.validation_rules)
      setTransformResult(null)
      setOutputDiff([])
      authoring.setDraftExplanation("")
      authoring.setUnresolvedTargetPaths([])
      authoring.clearMappingSuggestions()
      authoring.setAutoMapStatus("idle")
    })
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
        selectedTemplateId ? createTemplateVersionEffect(selectedTemplateId, request) : createTemplateEffect(request)
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

  function templateRequest() {
    return {
      name: templateName.trim(),
      description: templateDescription.trim(),
      source_format: setup.activeSourceFormat,
      target_format: setup.activeTargetFormat,
      source_schema_id: setup.selectedSourceSchema?.schema_id ?? null,
      target_schema_id: setup.selectedTargetSchema?.schema_id ?? null,
      source_schema_snapshot: setup.activeSourceSchema,
      target_schema_snapshot: setup.activeTargetSchema,
      mapping_spec: authoring.mappingSpec,
      validation_rules: validationErrors,
      sample_source_content: setup.selectedSourceSchema?.original_content ?? setup.sourceInput,
      sample_target_content: setup.selectedTargetSchema?.original_content ?? setup.targetInput,
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
      setup.sourceInput.trim().length > 0 ||
      setup.targetInput.trim().length > 0 ||
      authoring.script.trim() !== DEFAULT_SCRIPT.trim() ||
      Boolean(transformResult) ||
      validationErrors.length > 0
    )
  }

  function resetToBlankMapping() {
    setup.resetSetup()
    authoring.resetAuthoring()
    setTransformResult(null)
    setValidationErrors([])
    setOutputDiff([])
    setIssue(null)
    setActiveTemplate(null)
    setSelectedTemplateId("")
    setTemplateName("Untitled transform")
    setTemplateDescription("")
  }

  return {
    ...setup,
    suggestions: authoring.suggestions,
    script: authoring.script,
    draftExplanation: authoring.draftExplanation,
    unresolvedTargetPaths: authoring.unresolvedTargetPaths,
    transformResult,
    validationErrors,
    outputDiff,
    providerErrors: authoring.providerErrors,
    usedAi: authoring.usedAi,
    autoMapMode: authoring.autoMapMode,
    aiMappingAvailable: authoring.aiMappingAvailable,
    templates,
    activeTemplate,
    selectedTemplateId,
    templateName,
    templateDescription,
    issue,
    busyAction,
    newMappingPrompt,
    readyForTransform,
    readyForTemplateSave,
    statusText,
    autoMapStatusText: authoring.autoMapStatusText,
    setAutoMapMode: authoring.setAutoMapMode,
    setTemplateName,
    setTemplateDescription,
    setScript: authoring.setScript,
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
  }
}
