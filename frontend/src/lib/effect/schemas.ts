import type { SchemaNode } from "@/types/schema"

export function flattenSchema(schema: SchemaNode | null): SchemaNode[] {
  if (!schema) return []
  if (schema.type === "object" && schema.fields) {
    return Object.values(schema.fields).flatMap(flattenSchema)
  }
  if (schema.type === "array" && schema.items) {
    return flattenSchema(schema.items)
  }
  return [schema]
}
