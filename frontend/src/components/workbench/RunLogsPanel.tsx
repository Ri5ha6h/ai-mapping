import { TerminalSquare } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { ScriptLogItem } from "@/types/mapping"
import { WorkbenchCard } from "./ui"

type Props = {
  logs: ScriptLogItem[]
}

export function RunLogsPanel({ logs }: Props) {
  return (
    <WorkbenchCard
      kicker="Debug"
      title="Run logs"
      icon={<TerminalSquare size={18} />}
    >
      <div className="grid gap-2">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No console output from the last run.
          </p>
        ) : (
          logs.map((log) => (
            <div
              className="grid gap-1 rounded-lg border bg-muted/25 px-3 py-2"
              key={log.index}
            >
              <Badge
                variant={log.level === "error" ? "destructive" : "outline"}
              >
                {log.level}
              </Badge>
              <code className="text-xs break-words text-muted-foreground">
                {log.message}
              </code>
            </div>
          ))
        )}
      </div>
    </WorkbenchCard>
  )
}
