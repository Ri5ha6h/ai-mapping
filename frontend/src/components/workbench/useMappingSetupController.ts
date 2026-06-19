import { useCallback, useEffect, useMemo, useState } from "react"
import { Effect } from "effect"

import { SAMPLE_SOURCE_JSON, SAMPLE_TARGET_JSON } from "@/components/workbench/constants"
import { inferSchemaEffect, listFieldValidationRulesEffect, parseEffect } from "@/lib/effect/api_effects"
import type { OutputFormat, SourceFormat } from "@/types/mapping"
import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import type { FieldValidationRule } from "@/types/validation"

export type RunMode = "saved-sample" | "override"

export type MappingSetupControllerArgs = {
  sourceSchemas: SchemaArtifact[]
  targetSchemas: SchemaArtifact[]
  onSetupChanged: () => void
}

export type CurrentMappingInputs = {
  sourceData: unknown
  targetData: unknown
  sourceSchema: SchemaNode
  targetSchema: SchemaNode
  fieldValidationRules: FieldValidationRule[]
}

export function useMappingSetupController({
  sourceSchemas,
  targetSchemas,
  onSetupChanged,
}: MappingSetupControllerArgs) {
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
  const [fieldValidationRules, setFieldValidationRules] = useState<FieldValidationRule[]>([])

  const selectedSourceSchema = useMemo(
    () => sourceSchemas.find((schema) => schema.schema_id === selectedSourceSchemaId) ?? null,
    [selectedSourceSchemaId, sourceSchemas]
  )
  const selectedTargetSchema = useMemo(
    () => targetSchemas.find((schema) => schema.schema_id === selectedTargetSchemaId) ?? null,
    [selectedTargetSchemaId, targetSchemas]
  )
  const activeSourceSchema = selectedSourceSchema?.inferred_schema ?? sourceSchema
  const activeTargetSchema = selectedTargetSchema?.inferred_schema ?? targetSchema
  const activeSourceFormat = selectedSourceSchema?.format ?? sourceFormat
  const activeTargetFormat = selectedTargetSchema
    ? outputFormatForSchema(selectedTargetSchema)
    : targetFormat
  const readyForMapping = Boolean(activeSourceSchema && activeTargetSchema)
  const sourceReference = selectedSourceSchema?.canonical_sample ?? parseReferenceSource(sourceInput)

  useEffect(() => {
    let ignore = false
    if (!selectedTargetSchema) {
      return
    }

    Effect.runPromise(listFieldValidationRulesEffect(selectedTargetSchema.schema_id))
      .then((response) => {
        if (!ignore) setFieldValidationRules(response.rules)
      })
      .catch(() => {
        if (!ignore) setFieldValidationRules([])
      })

    return () => {
      ignore = true
    }
  }, [selectedTargetSchema])

  const parseAndInfer = useCallback(async () => {
    const parsedSource = await Effect.runPromise(parseEffect(sourceFormat, sourceInput))
    const parsedTarget = await Effect.runPromise(parseEffect(targetFormat, targetInput))
    const [sourceResult, targetResult] = await Promise.all([
      Effect.runPromise(inferSchemaEffect(parsedSource.canonical)),
      Effect.runPromise(inferSchemaEffect(parsedTarget.canonical)),
    ])
    setSourceSchema(sourceResult.schema)
    setTargetSchema(targetResult.schema)
    onSetupChanged()
  }, [onSetupChanged, sourceFormat, sourceInput, targetFormat, targetInput])

  const currentMappingInputs = useCallback(async (): Promise<CurrentMappingInputs> => {
    const nextSourceSchema = selectedSourceSchema?.inferred_schema ?? sourceSchema
    const nextTargetSchema = selectedTargetSchema?.inferred_schema ?? targetSchema
    if (!nextSourceSchema || !nextTargetSchema) {
      throw new Error("Select or infer a source and target schema before running a script.")
    }

    let sourceData: unknown
    if (runMode === "override") {
      const parsedOverride = await Effect.runPromise(
        parseEffect(activeSourceFormat, overrideSourceInput)
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

    const targetData = selectedTargetSchema
      ? selectedTargetSchema.canonical_sample
      : (await Effect.runPromise(parseEffect(targetFormat, targetInput))).canonical
    if (selectedTargetSchema) setTargetInput(selectedTargetSchema.original_content)
    setSourceFormat(activeSourceFormat)
    setTargetFormat(activeTargetFormat)
    setSourceSchema(nextSourceSchema)
    setTargetSchema(nextTargetSchema)
    const nextFieldValidationRules = selectedTargetSchema
      ? (await Effect.runPromise(listFieldValidationRulesEffect(selectedTargetSchema.schema_id))).rules
      : fieldValidationRules
    setFieldValidationRules(nextFieldValidationRules)
    return {
      sourceData,
      targetData,
      sourceSchema: nextSourceSchema,
      targetSchema: nextTargetSchema,
      fieldValidationRules: nextFieldValidationRules,
    }
  }, [
    activeSourceFormat,
    activeTargetFormat,
    fieldValidationRules,
    overrideSourceInput,
    runMode,
    selectedSourceSchema,
    selectedTargetSchema,
    sourceFormat,
    sourceInput,
    sourceSchema,
    targetFormat,
    targetInput,
    targetSchema,
  ])

  function selectSourceSchema(schemaId: string) {
    const schema = sourceSchemas.find((item) => item.schema_id === schemaId) ?? null
    setSelectedSourceSchemaId(schemaId)
    if (schema) {
      setSourceFormat(schema.format)
      setSourceInput(schema.original_content)
      setSourceSchema(schema.inferred_schema)
      setOverrideSourceInput(schema.original_content)
    } else {
      setSourceSchema(null)
    }
    onSetupChanged()
  }

  function selectTargetSchema(schemaId: string) {
    const schema = targetSchemas.find((item) => item.schema_id === schemaId) ?? null
    setSelectedTargetSchemaId(schemaId)
    if (schema) {
      setTargetFormat(outputFormatForSchema(schema))
      setTargetInput(schema.original_content)
      setTargetSchema(schema.inferred_schema)
    } else {
      setTargetSchema(null)
      setFieldValidationRules([])
    }
    onSetupChanged()
  }

  function resetSetup() {
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
    setFieldValidationRules([])
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
    activeSourceSchema,
    activeTargetSchema,
    activeSourceFormat,
    activeTargetFormat,
    fieldValidationRules,
    readyForMapping,
    setSourceFormat,
    setTargetFormat,
    setSourceInput,
    setTargetInput,
    setRunMode,
    setOverrideSourceInput,
    setSelectedSourceSchemaId,
    setSelectedTargetSchemaId,
    setSourceSchema,
    setTargetSchema,
    setFieldValidationRules,
    selectSourceSchema,
    selectTargetSchema,
    parseAndInfer,
    currentMappingInputs,
    resetSetup,
  }
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

export type MappingSetupController = ReturnType<typeof useMappingSetupController>
