import { BrainCircuit } from "lucide-react"

import type { MappingSuggestion } from "@/types/mapping"

type Props = {
  suggestions: MappingSuggestion[]
  usedAi: boolean
  statusText: string
  providerErrors: string[]
}

export function MappingSuggestionPanel({ suggestions, usedAi, statusText, providerErrors }: Props) {
  return (
    <section className="tool-panel suggestion-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Script hints</p>
          <h2>Likely field links</h2>
        </div>
        <BrainCircuit size={18} className="text-muted-foreground" />
      </div>
      <div className="status-strip">
        <span>{statusText}</span>
        <span>{usedAi ? "OpenRouter" : "Deterministic"}</span>
        <span>{suggestions.length} hints</span>
      </div>
      {providerErrors.map((error) => (
        <p className="issue-line" key={error}>
          {error}
        </p>
      ))}
      <div className="suggestion-stack">
        {suggestions.length === 0 ? (
          <p className="empty-line">No field hints generated yet.</p>
        ) : (
          suggestions.map((suggestion) => (
            <div className="suggestion-row" key={suggestion.id}>
              <div>
                <strong>{suggestion.target_path}</strong>
                <span>{suggestion.source_path}</span>
              </div>
              <meter min={0} max={1} value={suggestion.confidence} />
              <b>{Math.round(suggestion.confidence * 100)}%</b>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
