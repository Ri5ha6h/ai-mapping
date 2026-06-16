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

export type NativeGraphTransform = {
  type: string
  pattern?: string | null
  replacement?: string
  input_format?: string | null
  output_format?: string | null
  lookup_table?: string | null
  default?: unknown
  factor?: number | null
  separator?: string | null
  index?: number | null
  precision?: number | null
}

export type NativeGraphNodeType =
  | "assign"
  | "loop"
  | "compute"
  | "template"
  | "object"
  | "array"
  | "map"
  | "filter"
  | "reduce"
  | "conditional"
  | "lookup"
  | "switch"
  | "append"
  | "merge"
  | "group_by"
  | "sort"

export type NativeGraphNode = {
  id: string
  type: NativeGraphNodeType
  target_path?: string | null
  source_path?: string | null
  source_paths?: string[]
  var_name?: string | null
  value?: unknown
  expression?: string | null
  operation?: string | null
  condition?: Record<string, unknown> | null
  lookup_table?: string | null
  key_path?: string | null
  value_path?: string | null
  sort_path?: string | null
  group_key_path?: string | null
  descending?: boolean
  include_empty?: boolean
  transforms?: NativeGraphTransform[]
  children?: NativeGraphNode[]
}

export type NativeGraphSpec = {
  spec_version: number
  nodes: NativeGraphNode[]
  lookup_tables?: Record<string, Record<string, unknown>>
}

export type MappingSpec = {
  engine: string
  spec_version?: number | null
  rules: MappingRule[]
  native_graph?: NativeGraphSpec | null
  full_jsonata_expression?: string | null
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
  source_schema_id?: string | null
  target_schema_id?: string | null
  source_schema_snapshot?: SchemaNode | null
  target_schema_snapshot?: SchemaNode | null
  mapping_spec: MappingSpec
  validation_rules?: ValidationErrorItem[]
  sample_source_content?: string | null
  sample_target_content?: string | null
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

export type OutputDiffItem = {
  path: string
  kind: "missing" | "extra" | "changed"
  expected?: unknown
  actual?: unknown
}

export type OutputDiffResponse = {
  equal: boolean
  diffs: OutputDiffItem[]
}

export type NativeGraphDraftResponse = {
  mapping_spec: MappingSpec
  unresolved_target_paths: string[]
  used_ai: boolean
  provider_errors: string[]
}

export type TransformResponse = {
  output_format: OutputFormat
  output: unknown
  validation_errors: ValidationErrorItem[]
  trace?: Array<{
    node_id: string
    node_type: string
    target_path?: string | null
    status: "executed" | "failed" | "skipped"
    message: string
  }>
}

export type WorkbenchPayload = {
  sourceSchema: SchemaNode | null
  targetSchema: SchemaNode | null
}
