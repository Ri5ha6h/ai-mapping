import { Effect } from "effect"

import {
  createSchemaArtifact,
  createTemplate,
  createTemplateVersion,
  deleteSchemaArtifact,
  deleteTemplate,
  diffOutput,
  generateScriptDraft,
  getMappingCapabilities,
  getTemplate,
  inferSchema,
  listFieldValidationRules,
  listSchemaArtifacts,
  listTemplates,
  parsePayload,
  restoreSchemaArtifact,
  restoreTemplate,
  suggestMappings,
  transformPayload,
  upsertFieldValidationRule,
  validatePayload,
} from "@/lib/api/client"
import type {
  MappingSpec,
  OutputFormat,
  SourceFormat,
  TemplateCreateRequest,
  TemplateVersionCreateRequest,
} from "@/types/mapping"
import type {
  SchemaArtifactCreateRequest,
  SchemaDirection,
  SchemaNode,
} from "@/types/schema"
import type {
  FieldValidationRule,
  FieldValidationRuleUpsertRequest,
} from "@/types/validation"

export const parseEffect = (format: SourceFormat, content: string) =>
  Effect.tryPromise({
    try: () => parsePayload(format, content),
    catch: (error) => error,
  })

export const inferSchemaEffect = (data: unknown) =>
  Effect.tryPromise({
    try: () => inferSchema(data),
    catch: (error) => error,
  })

export const createSchemaArtifactEffect = (
  request: SchemaArtifactCreateRequest
) =>
  Effect.tryPromise({
    try: () => createSchemaArtifact(request),
    catch: (error) => error,
  })

export const listSchemaArtifactsEffect = (
  direction?: SchemaDirection,
  includeDeleted = false
) =>
  Effect.tryPromise({
    try: () => listSchemaArtifacts({ direction, includeDeleted }),
    catch: (error) => error,
  })

export const deleteSchemaArtifactEffect = (schemaId: string) =>
  Effect.tryPromise({
    try: () => deleteSchemaArtifact(schemaId),
    catch: (error) => error,
  })

export const restoreSchemaArtifactEffect = (schemaId: string) =>
  Effect.tryPromise({
    try: () => restoreSchemaArtifact(schemaId),
    catch: (error) => error,
  })

export const listFieldValidationRulesEffect = (schemaId: string) =>
  Effect.tryPromise({
    try: () => listFieldValidationRules(schemaId),
    catch: (error) => error,
  })

export const upsertFieldValidationRuleEffect = (
  schemaId: string,
  request: FieldValidationRuleUpsertRequest
) =>
  Effect.tryPromise({
    try: () => upsertFieldValidationRule(schemaId, request),
    catch: (error) => error,
  })

export const suggestMappingsEffect = (
  sourceSchema: SchemaNode,
  targetSchema: SchemaNode,
  useAi: boolean
) =>
  Effect.tryPromise({
    try: () => suggestMappings({ sourceSchema, targetSchema, useAi }),
    catch: (error) => error,
  })

export const getMappingCapabilitiesEffect = () =>
  Effect.tryPromise({
    try: () => getMappingCapabilities(),
    catch: (error) => error,
  })

export const generateScriptDraftEffect = (
  sourceSample: unknown,
  targetSample: unknown,
  sourceSchema: SchemaNode | null,
  targetSchema: SchemaNode | null,
  fieldValidationRules: FieldValidationRule[],
  useAi: boolean
) =>
  Effect.tryPromise({
    try: () =>
      generateScriptDraft({
        sourceSample,
        targetSample,
        sourceSchema,
        targetSchema,
        fieldValidationRules,
        useAi,
      }),
    catch: (error) => error,
  })

export const transformEffect = (
  sourceData: unknown,
  mappingSpec: MappingSpec,
  outputFormat: OutputFormat,
  targetSchema: SchemaNode | null,
  fieldValidationRules: FieldValidationRule[] = []
) =>
  Effect.tryPromise({
    try: () =>
      transformPayload({
        sourceData,
        mappingSpec,
        outputFormat,
        targetSchema,
        fieldValidationRules,
      }),
    catch: (error) => error,
  })

export const validateEffect = (
  sourceData: unknown,
  output: unknown,
  mappingSpec: MappingSpec,
  targetSchema: SchemaNode | null,
  outputFormat: OutputFormat,
  fieldValidationRules: FieldValidationRule[] = []
) =>
  Effect.tryPromise({
    try: () =>
      validatePayload({
        sourceData,
        output,
        mappingSpec,
        targetSchema,
        outputFormat,
        fieldValidationRules,
      }),
    catch: (error) => error,
  })

export const diffOutputEffect = (
  expected: unknown,
  actual: unknown,
  outputFormat: OutputFormat
) =>
  Effect.tryPromise({
    try: () => diffOutput({ expected, actual, outputFormat }),
    catch: (error) => error,
  })

export const createTemplateEffect = (request: TemplateCreateRequest) =>
  Effect.tryPromise({
    try: () => createTemplate(request),
    catch: (error) => error,
  })

export const listTemplatesEffect = (includeDeleted = false) =>
  Effect.tryPromise({
    try: () => listTemplates({ includeDeleted }),
    catch: (error) => error,
  })

export const getTemplateEffect = (templateId: string) =>
  Effect.tryPromise({
    try: () => getTemplate(templateId),
    catch: (error) => error,
  })

export const createTemplateVersionEffect = (
  templateId: string,
  request: TemplateVersionCreateRequest
) =>
  Effect.tryPromise({
    try: () => createTemplateVersion(templateId, request),
    catch: (error) => error,
  })

export const deleteTemplateEffect = (templateId: string) =>
  Effect.tryPromise({
    try: () => deleteTemplate(templateId),
    catch: (error) => error,
  })

export const restoreTemplateEffect = (templateId: string) =>
  Effect.tryPromise({
    try: () => restoreTemplate(templateId),
    catch: (error) => error,
  })
