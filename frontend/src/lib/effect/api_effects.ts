import { Effect } from "effect"

import {
  createSchemaArtifact,
  createTemplate,
  createTemplateVersion,
  deleteSchemaArtifact,
  diffOutput,
  generateScriptDraft,
  getMappingCapabilities,
  getSchemaArtifact,
  getTemplate,
  inferSchema,
  listSchemaArtifacts,
  listTemplates,
  parsePayload,
  suggestMappings,
  transformPayload,
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
  request: SchemaArtifactCreateRequest,
) =>
  Effect.tryPromise({
    try: () => createSchemaArtifact(request),
    catch: (error) => error,
  })

export const listSchemaArtifactsEffect = (
  direction?: SchemaDirection,
  includeDeleted = false,
) =>
  Effect.tryPromise({
    try: () => listSchemaArtifacts({ direction, includeDeleted }),
    catch: (error) => error,
  })

export const getSchemaArtifactEffect = (schemaId: string) =>
  Effect.tryPromise({
    try: () => getSchemaArtifact(schemaId),
    catch: (error) => error,
  })

export const deleteSchemaArtifactEffect = (schemaId: string) =>
  Effect.tryPromise({
    try: () => deleteSchemaArtifact(schemaId),
    catch: (error) => error,
  })

export const suggestMappingsEffect = (
  sourceSchema: SchemaNode,
  targetSchema: SchemaNode,
  useAi: boolean,
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
  useAi: boolean,
) =>
  Effect.tryPromise({
    try: () =>
      generateScriptDraft({
        sourceSample,
        targetSample,
        sourceSchema,
        targetSchema,
        useAi,
      }),
    catch: (error) => error,
  })

export const transformEffect = (
  sourceData: unknown,
  mappingSpec: MappingSpec,
  outputFormat: OutputFormat,
  targetSchema: SchemaNode | null,
) =>
  Effect.tryPromise({
    try: () => transformPayload({ sourceData, mappingSpec, outputFormat, targetSchema }),
    catch: (error) => error,
  })

export const validateEffect = (
  sourceData: unknown,
  output: unknown,
  mappingSpec: MappingSpec,
  targetSchema: SchemaNode | null,
) =>
  Effect.tryPromise({
    try: () => validatePayload({ sourceData, output, mappingSpec, targetSchema }),
    catch: (error) => error,
  })

export const diffOutputEffect = (expected: unknown, actual: unknown) =>
  Effect.tryPromise({
    try: () => diffOutput({ expected, actual }),
    catch: (error) => error,
  })

export const createTemplateEffect = (request: TemplateCreateRequest) =>
  Effect.tryPromise({
    try: () => createTemplate(request),
    catch: (error) => error,
  })

export const listTemplatesEffect = () =>
  Effect.tryPromise({
    try: () => listTemplates(),
    catch: (error) => error,
  })

export const getTemplateEffect = (templateId: string) =>
  Effect.tryPromise({
    try: () => getTemplate(templateId),
    catch: (error) => error,
  })

export const createTemplateVersionEffect = (
  templateId: string,
  request: TemplateVersionCreateRequest,
) =>
  Effect.tryPromise({
    try: () => createTemplateVersion(templateId, request),
    catch: (error) => error,
  })
