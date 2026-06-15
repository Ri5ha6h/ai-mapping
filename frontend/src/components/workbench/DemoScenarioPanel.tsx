import { FileJson, FileText, Route } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { OutputFormat, SourceFormat } from "@/types/mapping"

export type DemoScenario = {
  id: string
  label: string
  description: string
  sourceFormat: SourceFormat
  targetFormat: OutputFormat
  source: string
  target: string
  icon: "json" | "xml" | "edi"
}

type Props = {
  scenarios: DemoScenario[]
  activeScenarioId: string
  busyAction: string | null
  onSelect: (scenario: DemoScenario) => void
}

export function DemoScenarioPanel({ scenarios, activeScenarioId, busyAction, onSelect }: Props) {
  return (
    <section className="tool-panel scenario-panel">
      <div>
        <p className="panel-kicker">Demo scenarios</p>
        <h2>Load a review-ready flow</h2>
      </div>
      <div className="scenario-list">
        {scenarios.map((scenario) => (
          <Button
            key={scenario.id}
            type="button"
            variant={activeScenarioId === scenario.id ? "default" : "outline"}
            onClick={() => onSelect(scenario)}
            disabled={Boolean(busyAction)}
          >
            {scenario.icon === "json" ? <FileJson size={15} /> : null}
            {scenario.icon === "xml" ? <FileText size={15} /> : null}
            {scenario.icon === "edi" ? <Route size={15} /> : null}
            {scenario.label}
          </Button>
        ))}
      </div>
      <p className="empty-line">
        {scenarios.find((scenario) => scenario.id === activeScenarioId)?.description ??
          "Choose a scenario, then create schemas, auto map, run, and save template versions."}
      </p>
    </section>
  )
}
