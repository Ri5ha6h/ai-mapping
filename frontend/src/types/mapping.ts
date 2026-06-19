import type { SchemaNode } from "./schema"
import type { FieldValidationRuleUpsertRequest, ValidationErrorItem } from "./validation"

export type SourceFormat = "json" | "xml" | "edi_214" | "edi_856"
export type OutputFormat = "json" | "xml"

export type MappingSpec = {
  engine: "script_js"
  script_version?: number
  script: string
}

export type TemplateVersion = {
  version: number
  source_format: SourceFormat
  target_format: OutputFormat
  source_schema_id?: string | null
  target_schema_id?: string | null
  source_schema_snapshot?: SchemaNode | null
  target_schema_snapshot?: SchemaNode | null
  mapping_spec: MappingSpec
  validation_rules: ValidationErrorItem[]
  field_validation_rules: FieldValidationRuleUpsertRequest[]
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
  deleted_at?: string | null
  versions: TemplateVersion[]
}

export type TemplateCreateRequest = {
  template_id?: string | null
  name: string
  description?: string
  source_format: SourceFormat
  target_format: OutputFormat
  source_schema_id?: string | null
  target_schema_id?: string | null
  source_schema_snapshot?: SchemaNode | null
  target_schema_snapshot?: SchemaNode | null
  mapping_spec: MappingSpec
  validation_rules?: ValidationErrorItem[]
  field_validation_rules?: FieldValidationRuleUpsertRequest[]
  sample_source_content?: string | null
  sample_target_content?: string | null
}

export type TemplateVersionCreateRequest = Omit<TemplateCreateRequest, "template_id" | "name" | "description">

export type TemplateListResponse = {
  templates: MappingTemplate[]
}

export type MappingSuggestion = {
  id: string
  source_path: string
  target_path: string
  required: boolean
  confidence: number
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

export type OutputDiffItem = {
  path: string
  kind: "missing" | "extra" | "changed"
  expected?: unknown
  actual?: unknown
}

export type OutputDiffResponse = {
  equal: boolean
  diffs: OutputDiffItem[]
  supported: boolean
  message?: string | null
}

export type ScriptDraftResponse = {
  mapping_spec: MappingSpec
  explanation: string
  unresolved_target_paths: string[]
  used_ai: boolean
  provider_errors: string[]
}

export type ScriptLogItem = {
  level: "log" | "info" | "warn" | "error"
  message: string
  index: number
}

export type TransformResponse = {
  output_format: OutputFormat
  output: unknown
  validation_errors: ValidationErrorItem[]
  logs: ScriptLogItem[]
  trace?: Array<{
    step_id: string
    step_type: string
    target_path?: string | null
    status: "executed" | "failed" | "skipped"
    message: string
  }>
}

export type WorkbenchPayload = {
  sourceSchema: SchemaNode | null
  targetSchema: SchemaNode | null
}
