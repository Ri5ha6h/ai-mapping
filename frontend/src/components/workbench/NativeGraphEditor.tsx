import { memo, useState } from "react"
import { Braces, Play, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  value: string
  unresolvedPaths: string[]
  canGenerate: boolean
  busyAction: string | null
  onChange: (value: string) => void
  onApply: () => void
  onGenerate: () => void
  onRun: () => void
}

export const NativeGraphEditor = memo(function NativeGraphEditor({
  value,
  unresolvedPaths,
  canGenerate,
  busyAction,
  onChange,
  onApply,
  onGenerate,
  onRun,
}: Props) {
  const [localError, setLocalError] = useState("")

  function apply() {
    try {
      onApply()
      setLocalError("")
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Invalid native graph JSON.")
    }
  }

  function run() {
    try {
      onRun()
      setLocalError("")
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Invalid native graph JSON.")
    }
  }

  return (
    <section className="tool-panel native-graph-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Native graph</p>
          <h2>Structured spec</h2>
        </div>
        <Braces size={18} className="text-muted-foreground" />
      </div>
      <div className="native-graph-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onGenerate}
          disabled={!canGenerate || Boolean(busyAction)}
        >
          <Wand2 size={16} />
          Generate draft
        </Button>
        <Button type="button" variant="outline" onClick={apply} disabled={!value.trim()}>
          <Sparkles size={16} />
          Validate graph
        </Button>
        <Button type="button" onClick={run} disabled={!value.trim() || Boolean(busyAction)}>
          <Play size={16} />
          Run graph
        </Button>
      </div>
      <textarea
        className="native-graph-editor"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {localError ? <p className="native-graph-error">{localError}</p> : null}
      {unresolvedPaths.length > 0 ? (
        <div className="unresolved-list">
          <strong>Unresolved target paths</strong>
          {unresolvedPaths.slice(0, 12).map((path) => (
            <span key={path}>{path}</span>
          ))}
          {unresolvedPaths.length > 12 ? <span>+{unresolvedPaths.length - 12} more</span> : null}
        </div>
      ) : null}
    </section>
  )
})
