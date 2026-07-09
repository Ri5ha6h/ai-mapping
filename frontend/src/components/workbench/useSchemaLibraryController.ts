import { useCallback, useEffect, useMemo, useState } from "react"
import { Effect } from "effect"

import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import {
  createSchemaArtifactEffect,
  deleteSchemaArtifactEffect,
  listFieldValidationRulesEffect,
  listSchemaArtifactsEffect,
  restoreSchemaArtifactEffect,
  upsertFieldValidationRuleEffect,
} from "@/lib/effect/api_effects"
import type { SourceFormat } from "@/types/mapping"
import type {
  SchemaArtifact,
  SchemaDirection,
  SchemaInputMethod,
} from "@/types/schema"
import type {
  FieldValidationRule,
  FieldValidationRuleUpsertRequest,
} from "@/types/validation"

type SchemaDraft = {
  name: string
  description: string
  direction: SchemaDirection
  format: SourceFormat
  content: string
  inputMethod: SchemaInputMethod
  originalFilename: string | null
  originalContentType: string | null
  originalSize: number | null
}

const blankDraft: SchemaDraft = {
  name: "",
  description: "",
  direction: "source",
  format: "json",
  content: "",
  inputMethod: "paste",
  originalFilename: null,
  originalContentType: null,
  originalSize: null,
}

export function useSchemaLibraryController() {
  const [sourceSchemas, setSourceSchemas] = useState<SchemaArtifact[]>([])
  const [targetSchemas, setTargetSchemas] = useState<SchemaArtifact[]>([])
  const [deletedSchemas, setDeletedSchemas] = useState<SchemaArtifact[]>([])
  const [selectedSchemaId, setSelectedSchemaId] = useState("")
  const [selectedLibraryDirection, setSelectedLibraryDirection] =
    useState<SchemaDirection>("source")
  const [selectedTargetRules, setSelectedTargetRules] = useState<
    FieldValidationRule[]
  >([])
  const [targetRuleDrafts, setTargetRuleDrafts] = useState<
    Record<string, FieldValidationRuleUpsertRequest>
  >({})
  const [dirtyTargetRulePaths, setDirtyTargetRulePaths] = useState<string[]>([])
  const [draft, setDraft] = useState<SchemaDraft>(blankDraft)
  const [issue, setIssue] = useState<FrontendIssue | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>("Loading schemas")

  const allSchemas = useMemo(
    () => [...sourceSchemas, ...targetSchemas],
    [sourceSchemas, targetSchemas]
  )
  const selectedSchema =
    allSchemas.find((schema) => schema.schema_id === selectedSchemaId) ?? null
  const hasSchemaPair = sourceSchemas.length > 0 && targetSchemas.length > 0
  const canCreateSchema =
    draft.name.trim().length > 0 &&
    draft.content.trim().length > 0 &&
    !busyAction

  const refreshSchemas = useCallback(async () => {
    setBusyAction((current) => current ?? "Loading schemas")
    setIssue(null)
    try {
      const [sources, targets, allSources, allTargets] = await Promise.all([
        Effect.runPromise(listSchemaArtifactsEffect("source")),
        Effect.runPromise(listSchemaArtifactsEffect("target")),
        Effect.runPromise(listSchemaArtifactsEffect("source", true)),
        Effect.runPromise(listSchemaArtifactsEffect("target", true)),
      ])
      setSourceSchemas(sources.schemas)
      setTargetSchemas(targets.schemas)
      setDeletedSchemas(
        [...allSources.schemas, ...allTargets.schemas].filter((schema) =>
          Boolean(schema.deleted_at)
        )
      )
      setSelectedSchemaId((current) => {
        if (
          current &&
          [...sources.schemas, ...targets.schemas].some(
            (schema) => schema.schema_id === current
          )
        )
          return current
        const firstSource = sources.schemas.at(0)
        if (firstSource) return firstSource.schema_id
        const firstTarget = targets.schemas.at(0)
        return firstTarget ? firstTarget.schema_id : ""
      })
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction((current) =>
        current === "Loading schemas" ? null : current
      )
    }
  }, [])

  useEffect(() => {
    void refreshSchemas()
  }, [refreshSchemas])

  useEffect(() => {
    if (!selectedSchema || selectedSchema.direction !== "target") {
      setSelectedTargetRules([])
      setTargetRuleDrafts({})
      setDirtyTargetRulePaths([])
      return
    }

    let cancelled = false
    setBusyAction((current) => current ?? "Loading field rules")
    setIssue(null)
    Effect.runPromise(listFieldValidationRulesEffect(selectedSchema.schema_id))
      .then((response) => {
        if (!cancelled) {
          setSelectedTargetRules(response.rules)
          setTargetRuleDrafts(
            Object.fromEntries(
              response.rules.map((rule) => [rule.path, ruleToDraft(rule)])
            )
          )
          setDirtyTargetRulePaths([])
        }
      })
      .catch((error) => {
        if (!cancelled) setIssue(issueFromUnknown(error))
      })
      .finally(() => {
        if (!cancelled) {
          setBusyAction((current) =>
            current === "Loading field rules" ? null : current
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedSchema])

  async function createSchema() {
    if (!canCreateSchema) return
    setBusyAction("Creating schema")
    setIssue(null)
    try {
      const created = await Effect.runPromise(
        createSchemaArtifactEffect({
          name: draft.name.trim(),
          description: draft.description.trim(),
          direction: draft.direction,
          format: draft.format,
          content: draft.content,
          input_method: draft.inputMethod,
          original_filename: draft.originalFilename,
          original_content_type: draft.originalContentType,
          original_size: draft.originalSize,
        })
      )
      setDraft({
        ...blankDraft,
        direction: draft.direction,
        format: draft.direction === "target" ? "json" : draft.format,
      })
      await refreshSchemas()
      setSelectedLibraryDirection(created.direction)
      setSelectedSchemaId(created.schema_id)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function deleteSelectedSchema() {
    if (!selectedSchema) return
    setBusyAction("Deleting schema")
    setIssue(null)
    try {
      await Effect.runPromise(
        deleteSchemaArtifactEffect(selectedSchema.schema_id)
      )
      await refreshSchemas()
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function restoreSchema(schemaId: string) {
    setBusyAction("Restoring schema")
    setIssue(null)
    try {
      const restored = await Effect.runPromise(
        restoreSchemaArtifactEffect(schemaId)
      )
      await refreshSchemas()
      setSelectedLibraryDirection(restored.direction)
      setSelectedSchemaId(restored.schema_id)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function updateFieldRule(
    path: string,
    patch: Partial<FieldValidationRuleUpsertRequest>
  ) {
    const schema = selectedSchema
    if (!schema || schema.direction !== "target") return
    const current =
      targetRuleDrafts[path] ??
      selectedTargetRules.find((rule) => rule.path === path)
    const request = mergeRuleDraft(path, current, patch)
    setTargetRuleDrafts((drafts) => ({ ...drafts, [path]: request }))
    setDirtyTargetRulePaths((paths) =>
      paths.includes(path) ? paths : [...paths, path]
    )
  }

  async function saveFieldRules() {
    const schema = selectedSchema
    if (
      !schema ||
      schema.direction !== "target" ||
      dirtyTargetRulePaths.length === 0
    )
      return
    setBusyAction("Saving field rule")
    setIssue(null)
    try {
      const savedRules = await Promise.all(
        dirtyTargetRulePaths.map((path) => {
          const ruleDraft = targetRuleDrafts[path]
          return Effect.runPromise(
            upsertFieldValidationRuleEffect(schema.schema_id, ruleDraft)
          )
        })
      )
      setSelectedTargetRules((rules) => mergeSavedRules(rules, savedRules))
      setTargetRuleDrafts((drafts) => ({
        ...drafts,
        ...Object.fromEntries(
          savedRules.map((rule) => [rule.path, ruleToDraft(rule)])
        ),
      }))
      setDirtyTargetRulePaths([])
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  function updateDraft(patch: Partial<SchemaDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch }
      if (patch.direction === "target" && !isTargetFormat(next.format)) {
        next.format = "json"
      }
      return next
    })
  }

  async function useUploadedFile(file: File | undefined) {
    if (!file) return
    const content = await file.text()
    updateDraft({
      content,
      inputMethod: "upload",
      originalFilename: file.name,
      originalContentType: file.type || null,
      originalSize: file.size,
      name: draft.name || filenameToSchemaName(file.name),
    })
  }

  function usePastedContent(content: string) {
    updateDraft({
      content,
      inputMethod: "paste",
      originalFilename: null,
      originalContentType: null,
      originalSize: null,
    })
  }

  function selectSchema(schemaId: string) {
    const schema = allSchemas.find((item) => item.schema_id === schemaId)
    if (schema) setSelectedLibraryDirection(schema.direction)
    setSelectedSchemaId(schemaId)
  }

  return {
    sourceSchemas,
    targetSchemas,
    deletedSchemas,
    selectedLibraryDirection,
    selectedSchema,
    selectedSchemaId,
    selectedTargetRules,
    targetRuleDrafts,
    dirtyTargetRulePaths,
    draft,
    issue,
    busyAction,
    hasSchemaPair,
    canCreateSchema,
    setSelectedLibraryDirection,
    setSelectedSchemaId: selectSchema,
    updateDraft,
    useUploadedFile,
    usePastedContent,
    refreshSchemas,
    createSchema,
    deleteSelectedSchema,
    restoreSchema,
    updateFieldRule,
    saveFieldRules,
  }
}

function ruleToDraft(
  rule: FieldValidationRule
): FieldValidationRuleUpsertRequest {
  return {
    path: rule.path,
    value_type: rule.value_type,
    required: rule.required,
    min_value: rule.min_value ?? null,
    max_value: rule.max_value ?? null,
    min_length: rule.min_length ?? null,
    max_length: rule.max_length ?? null,
    description: rule.description ?? null,
  }
}

function mergeRuleDraft(
  path: string,
  current: Partial<FieldValidationRuleUpsertRequest> | undefined,
  patch: Partial<FieldValidationRuleUpsertRequest>
): FieldValidationRuleUpsertRequest {
  return {
    path,
    value_type: valueFromPatch(patch, current, "value_type", "mixed"),
    required: valueFromPatch(patch, current, "required", false),
    min_value: valueFromPatch(patch, current, "min_value", null),
    max_value: valueFromPatch(patch, current, "max_value", null),
    min_length: valueFromPatch(patch, current, "min_length", null),
    max_length: valueFromPatch(patch, current, "max_length", null),
    description: valueFromPatch(patch, current, "description", null),
  }
}

function valueFromPatch<TKey extends keyof FieldValidationRuleUpsertRequest>(
  patch: Partial<FieldValidationRuleUpsertRequest>,
  current: Partial<FieldValidationRuleUpsertRequest> | undefined,
  key: TKey,
  fallback: FieldValidationRuleUpsertRequest[TKey]
): FieldValidationRuleUpsertRequest[TKey] {
  if (Object.prototype.hasOwnProperty.call(patch, key)) {
    return patch[key] as FieldValidationRuleUpsertRequest[TKey]
  }
  return current?.[key] ?? fallback
}

function mergeSavedRules(
  current: FieldValidationRule[],
  saved: FieldValidationRule[]
) {
  const byPath = new Map(current.map((rule) => [rule.path, rule]))
  for (const rule of saved) byPath.set(rule.path, rule)
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}

function isTargetFormat(format: SourceFormat) {
  return format === "json" || format === "xml"
}

function filenameToSchemaName(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "")
  return withoutExtension
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
