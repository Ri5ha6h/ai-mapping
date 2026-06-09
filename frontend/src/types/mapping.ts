import type { SchemaNode } from "./schema"
import type { ValidationErrorItem } from "./validation"

export type SourceFormat = "json" | "xml" | "edi_214" | "edi_856"
export type OutputFormat = "json" | "xml"

export type RuleType =
  | "field"
  | "constant"
  | "concat"
  | "date_format"
  | "condition"
  | "loop"

export type MappingCondition = {
  source_path: string
  equals: unknown
  then: unknown
  otherwise?: unknown
}

export type LoopRule = {
  source_path: string
  target_path: string
  rules: MappingRule[]
}

export type MappingRule = {
  id: string
  type: RuleType
  source_path?: string | null
  target_path: string
  required?: boolean
  confidence?: number | null
  jsonata?: string | null
  value?: unknown
  source_paths?: string[]
  separator?: string
  input_format?: string
  output_format?: string
  condition?: MappingCondition | null
  loop?: LoopRule | null
}

export type MappingSpec = {
  engine: string
  rules: MappingRule[]
  full_jsonata_expression?: string | null
}

export type TemplateVersion = {
  version: number
  source_format: SourceFormat
  target_format: OutputFormat
  source_schema_snapshot?: SchemaNode | null
  target_schema_snapshot?: SchemaNode | null
  mapping_spec: MappingSpec
  validation_rules: ValidationErrorItem[]
  sample_source_content?: string | null
  sample_target_content?: string | null
  created_at: string
}

export type MappingTemplate = {
  template_id: string
  name: string
  description: string
  active_version: number
  is_seeded: boolean
  versions: TemplateVersion[]
}

export type TemplateCreateRequest = {
  template_id?: string | null
  name: string
  description?: string
  source_format: SourceFormat
  target_format: OutputFormat
  source_schema_snapshot?: SchemaNode | null
  target_schema_snapshot?: SchemaNode | null
  mapping_spec: MappingSpec
  validation_rules?: ValidationErrorItem[]
}

export type TemplateVersionCreateRequest = Omit<TemplateCreateRequest, "template_id" | "name" | "description">

export type TemplateListResponse = {
  templates: MappingTemplate[]
}

export type MappingSuggestion = MappingRule & {
  source_path: string
  required: boolean
  confidence: number
  jsonata: string
  explanation: string
  source: "rule_based" | "openrouter"
}

export type ParseResponse = {
  format: SourceFormat
  canonical: unknown
  metadata: Record<string, unknown>
}

export type SchemaInferResponse = {
  schema: SchemaNode
}

export type SuggestResponse = {
  suggestions: MappingSuggestion[]
  used_ai: boolean
  provider_errors: string[]
}

export type MappingCapabilities = {
  ai_mapping_available: boolean
  ai_provider?: string | null
}

export type TransformResponse = {
  output_format: OutputFormat
  output: unknown
  validation_errors: ValidationErrorItem[]
}

export type WorkbenchPayload = {
  sourceSchema: SchemaNode | null
  targetSchema: SchemaNode | null
}
