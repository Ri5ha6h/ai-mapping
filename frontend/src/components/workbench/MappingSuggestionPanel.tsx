import { BrainCircuit } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { StatusAlert, WorkbenchCard } from "@/components/workbench/ui"
import type { MappingSuggestion } from "@/types/mapping"

type Props = {
  suggestions: MappingSuggestion[]
  usedAi: boolean
  statusText: string
  providerErrors: string[]
}

export function MappingSuggestionPanel({ suggestions, usedAi, statusText, providerErrors }: Props) {
  return (
    <WorkbenchCard kicker="Script hints" title="Likely field links" icon={<BrainCircuit size={18} />}>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{statusText}</Badge>
        <Badge variant="secondary">{usedAi ? "OpenRouter" : "Deterministic"}</Badge>
        <Badge variant="outline">{suggestions.length} hints</Badge>
      </div>
      {providerErrors.map((error) => (
        <StatusAlert key={error} title="Provider notice" description={error} />
      ))}
      <div className="grid gap-2">
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No field hints generated yet.</p>
        ) : (
          suggestions.map((suggestion) => (
            <div className="grid gap-2 rounded-lg border bg-muted/25 px-3 py-2" key={suggestion.id}>
              <div className="grid min-w-0 gap-1">
                <strong className="truncate font-mono text-xs">{suggestion.target_path}</strong>
                <span className="truncate font-mono text-xs text-muted-foreground">{suggestion.source_path}</span>
              </div>
              <div className="flex items-center gap-2">
                <meter className="h-2 flex-1" min={0} max={1} value={suggestion.confidence} />
                <Badge variant="outline">{Math.round(suggestion.confidence * 100)}%</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </WorkbenchCard>
  )
}
