import { useCallback, useEffect, useMemo, useState } from "react"
import { Effect } from "effect"

import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import {
  createSchemaArtifactEffect,
  deleteSchemaArtifactEffect,
  listSchemaArtifactsEffect,
} from "@/lib/effect/api_effects"
import type { SourceFormat } from "@/types/mapping"
import type {
  SchemaArtifact,
  SchemaDirection,
  SchemaInputMethod,
} from "@/types/schema"

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
  const [selectedSchemaId, setSelectedSchemaId] = useState("")
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
      const [sources, targets] = await Promise.all([
        Effect.runPromise(listSchemaArtifactsEffect("source")),
        Effect.runPromise(listSchemaArtifactsEffect("target")),
      ])
      setSourceSchemas(sources.schemas)
      setTargetSchemas(targets.schemas)
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
      await Effect.runPromise(deleteSchemaArtifactEffect(selectedSchema.schema_id))
      await refreshSchemas()
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

  return {
    sourceSchemas,
    targetSchemas,
    selectedSchema,
    selectedSchemaId,
    draft,
    issue,
    busyAction,
    hasSchemaPair,
    canCreateSchema,
    setSelectedSchemaId,
    updateDraft,
    useUploadedFile,
    usePastedContent,
    refreshSchemas,
    createSchema,
    deleteSelectedSchema,
  }
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
