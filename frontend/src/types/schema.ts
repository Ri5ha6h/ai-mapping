export type SchemaType =
  | "object"
  | "array"
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "null"
  | "mixed"

export type SchemaNode = {
  type: SchemaType
  path: string
  required: boolean
  fields?: Record<string, SchemaNode> | null
  items?: SchemaNode | null
  examples: unknown[]
}

export type SchemaDirection = "source" | "target"
export type SchemaInputMethod = "paste" | "upload"

export type SchemaArtifact = {
  schema_id: string
  name: string
  description: string
  direction: SchemaDirection
  format: "json" | "xml" | "edi_214" | "edi_856"
  original_content: string
  original_filename?: string | null
  original_content_type?: string | null
  original_size: number
  input_method: SchemaInputMethod
  canonical_sample: unknown
  inferred_schema: SchemaNode
  parse_metadata: Record<string, unknown>
  deleted_at?: string | null
  created_at: string
}

export type SchemaArtifactCreateRequest = {
  schema_id?: string | null
  name: string
  description?: string
  direction: SchemaDirection
  format: SchemaArtifact["format"]
  content: string
  input_method?: SchemaInputMethod
  original_filename?: string | null
  original_content_type?: string | null
  original_size?: number | null
}

export type SchemaArtifactListResponse = {
  schemas: SchemaArtifact[]
}
