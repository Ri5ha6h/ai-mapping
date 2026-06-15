import { FileJson2 } from "lucide-react"

import type { TransformResponse } from "@/types/mapping"

type Props = {
  result: TransformResponse | null
}

export function OutputPreview({ result }: Props) {
  return (
    <section className="tool-panel output-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Transform</p>
          <h2>Output preview</h2>
        </div>
        <FileJson2 size={18} className="text-muted-foreground" />
      </div>
      <pre className="preview-block">
        {result ? formatOutput(result.output) : "No transformation output yet."}
      </pre>
    </section>
  )
}

function formatOutput(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2)
}
