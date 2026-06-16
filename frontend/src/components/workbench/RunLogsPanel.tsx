import { TerminalSquare } from "lucide-react"

import type { ScriptLogItem } from "@/types/mapping"

type Props = {
  logs: ScriptLogItem[]
}

export function RunLogsPanel({ logs }: Props) {
  return (
    <section className="tool-panel run-logs-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Debug</p>
          <h2>Run logs</h2>
        </div>
        <TerminalSquare size={18} className="text-muted-foreground" />
      </div>
      <div className="run-log-list">
        {logs.length === 0 ? (
          <p className="empty-line">No console output from the last run.</p>
        ) : (
          logs.map((log) => (
            <div className={`run-log-row ${log.level}`} key={log.index}>
              <span>{log.level}</span>
              <code>{log.message}</code>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
