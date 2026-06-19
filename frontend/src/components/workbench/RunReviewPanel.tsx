import { Loader2, Play, PlaySquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

type Props = {
  workbench: ReturnType<typeof useMappingWorkbenchController>
}

export function RunReviewPanel({ workbench }: Props) {
  return (
    <section className="tool-panel review-run-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Run input</p>
          <h2>Execute script</h2>
        </div>
        <Button
          type="button"
          onClick={() => void workbench.runTransform()}
          disabled={!workbench.readyForTransform || Boolean(workbench.busyAction)}
        >
          {workbench.busyAction === "Running script" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          Run script
        </Button>
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
          <Textarea
            className="code-input review-input-editor"
            value={workbench.overrideSourceInput}
            onChange={(event) =>
              workbench.setOverrideSourceInput(event.target.value)
            }
            spellCheck={false}
          />
        ) : (
          <div className="run-sample-summary">
            <PlaySquare size={16} />
            <span>
              {workbench.selectedSourceSchema
                ? `${workbench.selectedSourceSchema.name} saved sample`
                : "Loaded template sample"}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
