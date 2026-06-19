import { Database, FileText, Loader2, Play, PlaySquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

type Props = {
  workbench: ReturnType<typeof useMappingWorkbenchController>
}

export function RunReviewPanel({ workbench }: Props) {
  const activeTemplateLabel = workbench.activeTemplate
    ? `${workbench.activeTemplate.name} v${workbench.activeTemplate.active_version}`
    : "Unsaved mapping"
  const sampleLabel = workbench.selectedSourceSchema
    ? `${workbench.selectedSourceSchema.name} saved sample`
    : workbench.activeTemplate
      ? "Loaded template sample"
      : "Current setup sample"
  const runDisabled = !workbench.readyForTransform || Boolean(workbench.busyAction)

  return (
    <section className="tool-panel review-run-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Review cockpit</p>
          <h2>Run and inspect</h2>
        </div>
        <Button
          type="button"
          onClick={() => void workbench.runTransform()}
          disabled={runDisabled}
          aria-label="Run Script"
        >
          {workbench.busyAction === "Running script" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          Run Script
        </Button>
      </div>

      <div className="review-context-card" aria-live="polite">
        <Database size={16} />
        <div>
          <strong>{activeTemplateLabel}</strong>
          <span>
            {workbench.readyForTransform
              ? `Ready with ${workbench.fieldValidationRules.length} field rule(s).`
              : "Select schemas and author a script before running."}
          </span>
        </div>
      </div>

      <div className="run-mode-panel">
        <div className="field-stack">
          <span>Input source</span>
          <div className="schema-segmented-control">
            <button
              type="button"
              className={workbench.runMode === "saved-sample" ? "active" : ""}
              onClick={() => workbench.setRunMode("saved-sample")}
            >
              Saved sample
            </button>
            <button
              type="button"
              className={workbench.runMode === "override" ? "active" : ""}
              onClick={() => workbench.setRunMode("override")}
              disabled={!workbench.activeSourceSchema}
            >
              Override here
            </button>
          </div>
        </div>

        {workbench.runMode === "override" ? (
          <label className="field-stack review-override-stack">
            <span>Override source payload</span>
            <Textarea
              className="code-input review-input-editor"
              value={workbench.overrideSourceInput}
              onChange={(event) =>
                workbench.setOverrideSourceInput(event.target.value)
              }
              spellCheck={false}
            />
          </label>
        ) : (
          <div className="run-sample-summary">
            <PlaySquare size={16} />
            <span>{sampleLabel}</span>
          </div>
        )}
      </div>

      <div className="review-run-summary">
        <FileText size={16} />
        <span>
          {workbench.runMode === "override"
            ? "Review will parse and run the override payload."
            : `Review will run ${sampleLabel}.`}
        </span>
      </div>
    </section>
  )
}
