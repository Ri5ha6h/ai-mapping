import { GitCompareArrows } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { OutputDiffItem, OutputFormat } from "@/types/mapping"
import { WorkbenchCard } from "./ui"

type Props = {
  diffs: OutputDiffItem[]
  outputFormat?: OutputFormat
  hasRun?: boolean
}

export function OutputDiffPanel({
  diffs,
  outputFormat = "json",
  hasRun = false,
}: Props) {
  const diffUnavailable = outputFormat === "xml"

  return (
    <WorkbenchCard
      kicker="Compare"
      title="Target diff"
      icon={<GitCompareArrows size={18} />}
    >
      {diffUnavailable ? (
        <p className="text-sm text-muted-foreground">
          Diff is not available for XML output. Review the serialized XML
          preview or compare it externally.
        </p>
      ) : diffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasRun
            ? "No output differences after the last JSON run."
            : "Run a JSON transform to compare target output."}
        </p>
      ) : (
        <div className="grid gap-2">
          {diffs.slice(0, 20).map((diff) => (
            <div
              className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2"
              key={`${diff.kind}-${diff.path}`}
            >
              <Badge variant="outline">{diff.kind}</Badge>
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                {diff.path}
              </span>
            </div>
          ))}
          {diffs.length > 20 ? (
            <p className="text-sm text-muted-foreground">
              +{diffs.length - 20} more differences
            </p>
          ) : null}
        </div>
      )}
    </WorkbenchCard>
  )
}
