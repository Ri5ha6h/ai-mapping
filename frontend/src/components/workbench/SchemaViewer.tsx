import { Database } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { flattenSchema } from "@/lib/effect/schemas"
import type { SchemaNode } from "@/types/schema"
import { WorkbenchCard } from "./ui"

type Props = {
  title: string
  schema: SchemaNode | null
}

export function SchemaViewer({ title, schema }: Props) {
  const fields = flattenSchema(schema)

  return (
    <WorkbenchCard
      kicker="Selected schema"
      title={title}
      icon={<Database size={18} />}
      contentClassName="gap-2"
    >
      <ScrollArea className="max-h-72 pr-2">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No inferred fields yet.</p>
        ) : (
          <div className="grid gap-2">
            {fields.map((field) => (
              <div
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-muted/25 px-3 py-2"
                key={field.path}
              >
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                  {field.path}
                </span>
                <Badge variant="secondary">{field.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </WorkbenchCard>
  )
}
