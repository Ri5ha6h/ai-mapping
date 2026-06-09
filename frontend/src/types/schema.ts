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

