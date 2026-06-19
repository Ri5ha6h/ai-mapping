import { GitCompareArrows } from "lucide-react"

import type { OutputDiffItem, OutputFormat } from "@/types/mapping"

type Props = {
  diffs: OutputDiffItem[]
  outputFormat?: OutputFormat
  hasRun?: boolean
}

export function OutputDiffPanel({ diffs, outputFormat = "json", hasRun = false }: Props) {
  const diffUnavailable = outputFormat === "xml"

  return (
    <section className="tool-panel diff-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Compare</p>
          <h2>Target diff</h2>
        </div>
        <GitCompareArrows size={18} className="text-muted-foreground" />
      </div>
      {diffUnavailable ? (
        <p className="empty-note">Diff is not available for XML output. Review the serialized XML preview or compare it externally.</p>
      ) : diffs.length === 0 ? (
        <p className="empty-note">{hasRun ? "No output differences after the last JSON run." : "Run a JSON transform to compare target output."}</p>
      ) : (
        <div className="diff-list">
          {diffs.slice(0, 20).map((diff) => (
            <div className="diff-row" key={`${diff.kind}-${diff.path}`}>
              <strong>{diff.kind}</strong>
              <span>{diff.path}</span>
            </div>
          ))}
          {diffs.length > 20 ? <p className="empty-note">+{diffs.length - 20} more differences</p> : null}
        </div>
      )}
    </section>
  )
}
