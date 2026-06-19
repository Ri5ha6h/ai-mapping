import { useEffect, useState } from "react"
import { Effect } from "effect"

import {
  createTemplateEffect,
  createTemplateVersionEffect,
  deleteTemplateEffect,
  getTemplateEffect,
  listTemplatesEffect,
  restoreTemplateEffect,
} from "@/lib/effect/api_effects"
import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import type { MappingSpec, MappingTemplate, OutputFormat, SourceFormat } from "@/types/mapping"
import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import type { FieldValidationRule, ValidationErrorItem } from "@/types/validation"
import { DEFAULT_SCRIPT } from "./useScriptAuthoringController"

type NewMappingPromptState = { open: boolean; pending: boolean }

export type TemplateLifecycleControllerArgs = {
  activeSourceFormat: SourceFormat
  activeTargetFormat: OutputFormat
  activeSourceSchema: SchemaNode | null
  activeTargetSchema: SchemaNode | null
  selectedSourceSchema: SchemaArtifact | null
  selectedTargetSchema: SchemaArtifact | null
  sourceInput: string
  targetInput: string
  mappingSpec: MappingSpec
  validationErrors: ValidationErrorItem[]
  fieldValidationRules: FieldValidationRule[]
  readyForTemplateSave: boolean
  hasRunResult: boolean
  setIssue: (issue: FrontendIssue | null) => void
  setBusyAction: (action: string | null | ((current: string | null) => string | null)) => void
  setSourceFormat: (format: SourceFormat) => void
  setTargetFormat: (format: OutputFormat) => void
  setSelectedSourceSchemaId: (schemaId: string) => void
  setSelectedTargetSchemaId: (schemaId: string) => void
  setSourceInput: (value: string) => void
  setTargetInput: (value: string) => void
  setOverrideSourceInput: (value: string) => void
  setSourceSchema: (schema: SchemaNode | null) => void
  setTargetSchema: (schema: SchemaNode | null) => void
  setFieldValidationRules: (rules: FieldValidationRule[]) => void
  setScriptRaw: (script: string) => void
  restoreValidationErrors: (errors: ValidationErrorItem[]) => void
  clearRunResults: () => void
  resetSetup: () => void
  resetAuthoring: () => void
  clearAuthoringContext: () => void
}

export function useTemplateLifecycleController(args: TemplateLifecycleControllerArgs) {
  const [templates, setTemplates] = useState<MappingTemplate[]>([])
  const [deletedTemplates, setDeletedTemplates] = useState<MappingTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<MappingTemplate | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("Shipment transform")
  const [templateDescription, setTemplateDescription] = useState("")
  const [newMappingPrompt, setNewMappingPrompt] = useState<NewMappingPromptState>({ open: false, pending: false })

  async function refreshTemplates() {
    args.setBusyAction((current) => current ?? "Loading templates")
    try {
      const response = await Effect.runPromise(listTemplatesEffect(true))
      const activeTemplates = response.templates.filter((template) => !template.deleted_at)
      setTemplates(activeTemplates)
      setDeletedTemplates(response.templates.filter((template) => Boolean(template.deleted_at)))
      setActiveTemplate((current) =>
        current ? activeTemplates.find((template) => template.template_id === current.template_id) ?? null : current
      )
    } catch (error) {
      args.setIssue(issueFromUnknown(error))
    } finally {
      args.setBusyAction((current) => (current === "Loading templates" ? null : current))
    }
  }

  useEffect(() => {
    void refreshTemplates()
  }, [])

  async function saveTemplate() {
    if (!args.readyForTemplateSave) return
    await withTemplateBusy("Saving template", async () => {
      const template = await Effect.runPromise(createTemplateEffect(templateRequest(args, templateName, templateDescription)))
      await applySavedTemplate(template)
    })
  }

  async function saveTemplateVersion() {
    if (!args.readyForTemplateSave || !selectedTemplateId) return
    await withTemplateBusy("Saving version", async () => {
      const template = await Effect.runPromise(
        createTemplateVersionEffect(selectedTemplateId, templateRequest(args, templateName, templateDescription))
      )
      await applySavedTemplate(template)
    })
  }

  async function loadTemplate(templateId: string, versionNumber?: number) {
    await withTemplateBusy("Loading template", async () => {
      const template = await Effect.runPromise(getTemplateEffect(templateId))
      const version =
        template.versions.find((item) => item.version === (versionNumber ?? template.active_version)) ??
        template.versions.at(-1)
      if (!version) return

      setActiveTemplate(template)
      setSelectedTemplateId(template.template_id)
      setTemplateName(template.name)
      setTemplateDescription(template.description)
      args.setSourceFormat(version.source_format)
      args.setTargetFormat(version.target_format)
      args.setSelectedSourceSchemaId(version.source_schema_id ?? "")
      args.setSelectedTargetSchemaId(version.target_schema_id ?? "")
      if (version.sample_source_content) {
        args.setSourceInput(version.sample_source_content)
        args.setOverrideSourceInput(version.sample_source_content)
      }
      if (version.sample_target_content) args.setTargetInput(version.sample_target_content)
      args.setSourceSchema(version.source_schema_snapshot ?? null)
      args.setTargetSchema(version.target_schema_snapshot ?? null)
      args.setFieldValidationRules(snapshotFieldRules(version.field_validation_rules))
      args.setScriptRaw(version.mapping_spec.script || DEFAULT_SCRIPT)
      args.restoreValidationErrors(version.validation_rules)
      args.clearAuthoringContext()
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
    if (!args.readyForTemplateSave || templateName.trim().length === 0) {
      resetToBlankMapping()
      setNewMappingPrompt({ open: false, pending: false })
      return
    }

    setNewMappingPrompt({ open: true, pending: true })
    args.setBusyAction("Saving template")
    args.setIssue(null)
    try {
      const request = templateRequest(args, templateName, templateDescription)
      const template = await Effect.runPromise(
        selectedTemplateId ? createTemplateVersionEffect(selectedTemplateId, request) : createTemplateEffect(request)
      )
      await applySavedTemplate(template)
      resetToBlankMapping()
      setNewMappingPrompt({ open: false, pending: false })
    } catch (error) {
      args.setIssue(issueFromUnknown(error))
      setNewMappingPrompt({ open: true, pending: false })
    } finally {
      args.setBusyAction(null)
    }
  }

  async function withTemplateBusy(label: string, action: () => Promise<void>) {
    args.setBusyAction(label)
    args.setIssue(null)
    try {
      await action()
    } catch (error) {
      args.setIssue(issueFromUnknown(error))
    } finally {
      args.setBusyAction(null)
    }
  }

  async function applySavedTemplate(template: MappingTemplate) {
    setActiveTemplate(template)
    setSelectedTemplateId(template.template_id)
    setTemplateName(template.name)
    setTemplateDescription(template.description)
    const response = await Effect.runPromise(listTemplatesEffect(true))
    setTemplates(response.templates.filter((item) => !item.deleted_at))
    setDeletedTemplates(response.templates.filter((item) => Boolean(item.deleted_at)))
  }

  async function deleteTemplate(templateId: string) {
    await withTemplateBusy("Deleting template", async () => {
      await Effect.runPromise(deleteTemplateEffect(templateId))
      if (activeTemplate?.template_id === templateId) {
        setActiveTemplate(null)
        setSelectedTemplateId("")
      }
      await refreshTemplates()
    })
  }

  async function restoreTemplate(templateId: string) {
    await withTemplateBusy("Restoring template", async () => {
      const template = await Effect.runPromise(restoreTemplateEffect(templateId))
      await refreshTemplates()
      setSelectedTemplateId(template.template_id)
      setActiveTemplate(template)
    })
  }

  function hasUnsavedMapping() {
    return (
      args.sourceInput.trim().length > 0 ||
      args.targetInput.trim().length > 0 ||
      args.mappingSpec.script.trim() !== DEFAULT_SCRIPT.trim() ||
      args.hasRunResult ||
      args.validationErrors.length > 0
    )
  }

  function resetToBlankMapping() {
    args.resetSetup()
    args.resetAuthoring()
    args.clearRunResults()
    args.setIssue(null)
    setActiveTemplate(null)
    setSelectedTemplateId("")
    setTemplateName("Untitled transform")
    setTemplateDescription("")
  }

  return {
    templates,
    deletedTemplates,
    activeTemplate,
    selectedTemplateId,
    templateName,
    templateDescription,
    newMappingPrompt,
    setTemplateName,
    setTemplateDescription,
    refreshTemplates,
    saveTemplate,
    saveTemplateVersion,
    deleteTemplate,
    restoreTemplate,
    loadTemplate,
    selectTemplate,
    startNewMapping,
    cancelNewMapping,
    discardAndStartNewMapping,
    saveAndStartNewMapping,
  }
}

function templateRequest(args: TemplateLifecycleControllerArgs, name: string, description: string) {
  return {
    name: name.trim(),
    description: description.trim(),
    source_format: args.activeSourceFormat,
    target_format: args.activeTargetFormat,
    source_schema_id: args.selectedSourceSchema?.schema_id ?? null,
    target_schema_id: args.selectedTargetSchema?.schema_id ?? null,
    source_schema_snapshot: args.activeSourceSchema,
    target_schema_snapshot: args.activeTargetSchema,
    mapping_spec: args.mappingSpec,
    validation_rules: args.validationErrors,
    field_validation_rules: args.fieldValidationRules.map(
      ({ created_at: _createdAt, updated_at: _updatedAt, schema_id: _schemaId, ...rule }) => rule
    ),
    sample_source_content: args.selectedSourceSchema?.original_content ?? args.sourceInput,
    sample_target_content: args.selectedTargetSchema?.original_content ?? args.targetInput,
  }
}

function snapshotFieldRules(
  rules: NonNullable<MappingTemplate["versions"][number]["field_validation_rules"]>
): FieldValidationRule[] {
  const timestamp = new Date().toISOString()
  return rules.map((rule) => ({
    schema_id: "template-snapshot",
    created_at: timestamp,
    updated_at: timestamp,
    ...rule,
  }))
}

export type TemplateLifecycleController = ReturnType<typeof useTemplateLifecycleController>
