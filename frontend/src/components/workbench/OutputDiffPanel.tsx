import { GitCompareArrows } from "lucide-react"

import type { OutputDiffItem } from "@/types/mapping"

type Props = {
  diffs: OutputDiffItem[]
}

export function OutputDiffPanel({ diffs }: Props) {
  return (
    <section className="tool-panel diff-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Compare</p>
          <h2>Target diff</h2>
        </div>
        <GitCompareArrows size={18} className="text-muted-foreground" />
      </div>
      {diffs.length === 0 ? (
        <p className="empty-note">No output differences after the last run.</p>
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
