import { Effect } from "effect"

import {
  createTemplate,
  createTemplateVersion,
  getMappingCapabilities,
  getTemplate,
  inferSchema,
  listTemplates,
  parsePayload,
  suggestMappings,
  transformPayload,
  validatePayload,
} from "@/lib/api/client"
import type {
  MappingRule,
  OutputFormat,
  SourceFormat,
  TemplateCreateRequest,
  TemplateVersionCreateRequest,
} from "@/types/mapping"
import type { SchemaNode } from "@/types/schema"

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

export const transformEffect = (
  sourceData: unknown,
  rules: MappingRule[],
  outputFormat: OutputFormat,
  targetSchema: SchemaNode | null,
) =>
  Effect.tryPromise({
    try: () => transformPayload({ sourceData, rules, outputFormat, targetSchema }),
    catch: (error) => error,
  })

export const validateEffect = (
  sourceData: unknown,
  output: unknown,
  rules: MappingRule[],
  targetSchema: SchemaNode | null,
) =>
  Effect.tryPromise({
    try: () => validatePayload({ sourceData, output, rules, targetSchema }),
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
