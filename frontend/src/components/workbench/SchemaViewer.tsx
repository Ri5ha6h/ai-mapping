import { Database } from "lucide-react"

import { flattenSchema } from "@/lib/effect/schemas"
import type { SchemaNode } from "@/types/schema"

type Props = {
  title: string
  schema: SchemaNode | null
}

export function SchemaViewer({ title, schema }: Props) {
  const fields = flattenSchema(schema)

  return (
    <section className="tool-panel schema-viewer-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Selected schema</p>
          <h2>{title}</h2>
        </div>
        <Database size={18} className="text-muted-foreground" />
      </div>
      <div className="schema-list">
        {fields.length === 0 ? (
          <p className="empty-line">No inferred fields yet.</p>
        ) : (
          fields.map((field) => (
            <div className="schema-row" key={field.path}>
              <span>{field.path}</span>
              <strong>{field.type}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
