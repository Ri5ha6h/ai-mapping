import { useMemo, useState } from "react"

import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import type { SchemaArtifact } from "@/types/schema"
import { useMappingSetupController } from "./useMappingSetupController"
import { useRunReviewController } from "./useRunReviewController"
import { useScriptAuthoringController } from "./useScriptAuthoringController"
import { useTemplateLifecycleController } from "./useTemplateLifecycleController"

type MappingWorkbenchOptions = {
  sourceSchemas: SchemaArtifact[]
  targetSchemas: SchemaArtifact[]
}

export function useMappingWorkbenchController(options: MappingWorkbenchOptions) {
  const [issue, setIssue] = useState<FrontendIssue | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>("Loading templates")

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

  const setup = useMappingSetupController({
    sourceSchemas: options.sourceSchemas,
    targetSchemas: options.targetSchemas,
    onSetupChanged: () => runReview.clearRunResults(),
  })
  const authoring = useScriptAuthoringController({
    currentMappingInputs: setup.currentMappingInputs,
    clearRunResults: () => runReview.clearRunResults(),
  })
  const runReview = useRunReviewController({
    currentMappingInputs: setup.currentMappingInputs,
    mappingSpec: authoring.mappingSpec,
    outputFormat: setup.activeTargetFormat,
    readyForMapping: setup.readyForMapping,
    withBusy,
  })
  const templates = useTemplateLifecycleController({
    activeSourceFormat: setup.activeSourceFormat,
    activeTargetFormat: setup.activeTargetFormat,
    activeSourceSchema: setup.activeSourceSchema,
    activeTargetSchema: setup.activeTargetSchema,
    selectedSourceSchema: setup.selectedSourceSchema,
    selectedTargetSchema: setup.selectedTargetSchema,
    sourceInput: setup.sourceInput,
    targetInput: setup.targetInput,
    mappingSpec: authoring.mappingSpec,
    validationErrors: runReview.validationErrors,
    fieldValidationRules: setup.fieldValidationRules,
    readyForTemplateSave: runReview.readyForTransform,
    hasRunResult: Boolean(runReview.transformResult),
    setIssue,
    setBusyAction,
    setSourceFormat: setup.setSourceFormat,
    setTargetFormat: setup.setTargetFormat,
    setSelectedSourceSchemaId: setup.setSelectedSourceSchemaId,
    setSelectedTargetSchemaId: setup.setSelectedTargetSchemaId,
    setSourceInput: setup.setSourceInput,
    setTargetInput: setup.setTargetInput,
    setOverrideSourceInput: setup.setOverrideSourceInput,
    setSourceSchema: setup.setSourceSchema,
    setTargetSchema: setup.setTargetSchema,
    setFieldValidationRules: setup.setFieldValidationRules,
    setScriptRaw: authoring.setScriptRaw,
    restoreValidationErrors: runReview.restoreValidationErrors,
    clearRunResults: runReview.clearRunResults,
    resetSetup: setup.resetSetup,
    resetAuthoring: authoring.resetAuthoring,
    clearAuthoringContext: () => {
      authoring.setDraftExplanation("")
      authoring.setUnresolvedTargetPaths([])
      authoring.clearMappingSuggestions()
      authoring.setAutoMapStatus("idle")
    },
  })

  const statusText = useMemo(() => {
    if (busyAction) return busyAction
    return runReview.reviewStatusText
  }, [busyAction, runReview.reviewStatusText])

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

  return {
    ...setup,
    suggestions: authoring.suggestions,
    script: authoring.script,
    draftExplanation: authoring.draftExplanation,
    unresolvedTargetPaths: authoring.unresolvedTargetPaths,
    transformResult: runReview.transformResult,
    validationErrors: runReview.validationErrors,
    outputDiff: runReview.outputDiff,
    providerErrors: authoring.providerErrors,
    usedAi: authoring.usedAi,
    autoMapMode: authoring.autoMapMode,
    aiMappingAvailable: authoring.aiMappingAvailable,
    templates: templates.templates,
    deletedTemplates: templates.deletedTemplates,
    activeTemplate: templates.activeTemplate,
    selectedTemplateId: templates.selectedTemplateId,
    templateName: templates.templateName,
    templateDescription: templates.templateDescription,
    issue,
    busyAction,
    newMappingPrompt: templates.newMappingPrompt,
    readyForTransform: runReview.readyForTransform,
    readyForTemplateSave: runReview.readyForTransform,
    statusText,
    autoMapStatusText: authoring.autoMapStatusText,
    setAutoMapMode: authoring.setAutoMapMode,
    setTemplateName: templates.setTemplateName,
    setTemplateDescription: templates.setTemplateDescription,
    setScript: authoring.setScript,
    selectSourceSchema,
    selectTargetSchema,
    parseAndInfer,
    autoMap,
    generateScript,
    runTransform: runReview.runTransform,
    refreshTemplates: templates.refreshTemplates,
    saveTemplate: templates.saveTemplate,
    saveTemplateVersion: templates.saveTemplateVersion,
    deleteTemplate: templates.deleteTemplate,
    restoreTemplate: templates.restoreTemplate,
    startNewMapping: templates.startNewMapping,
    cancelNewMapping: templates.cancelNewMapping,
    discardAndStartNewMapping: templates.discardAndStartNewMapping,
    saveAndStartNewMapping: templates.saveAndStartNewMapping,
    loadTemplate: templates.loadTemplate,
    selectTemplate: templates.selectTemplate,
  }
}
