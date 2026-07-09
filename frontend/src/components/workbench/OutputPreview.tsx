import { FileJson2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { TransformResponse } from "@/types/mapping"
import { WorkbenchCard } from "./ui"

type Props = {
  result: TransformResponse | null
}

export function OutputPreview({ result }: Props) {
  return (
    <WorkbenchCard kicker="Transform" title="Output preview" icon={<FileJson2 size={18} />}>
      <pre className="preview-block">
        {result ? formatOutput(result.output) : "No transformation output yet."}
      </pre>
      {result?.trace?.length ? (
        <div className="grid gap-2">
          {result.trace.map((item) => (
            <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2" key={`${item.step_id}-${item.target_path ?? ""}`}>
              <Badge variant="secondary">{item.step_id}</Badge>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {item.status} {item.target_path ? `to ${item.target_path}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </WorkbenchCard>
  )
}

function formatOutput(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2)
}
