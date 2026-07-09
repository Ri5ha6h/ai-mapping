import { Database, FileText, Loader2, Play, PlaySquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"
import { Field, SegmentedControl, StatusAlert, WorkbenchCard } from "./ui"

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
  const runDisabled =
    !workbench.readyForTransform || Boolean(workbench.busyAction)

  return (
    <WorkbenchCard
      kicker="Review cockpit"
      title="Run and inspect"
      action={
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
      }
    >
      <StatusAlert
        icon={<Database size={16} />}
        title={activeTemplateLabel}
        description={
          workbench.readyForTransform
            ? `Ready with ${workbench.fieldValidationRules.length} field rule(s).`
            : "Select schemas and author a script before running."
        }
      />

      <div className="grid gap-3">
        <Field label="Input source">
          <SegmentedControl
            value={workbench.runMode}
            onValueChange={workbench.setRunMode}
            options={[
              { value: "saved-sample", label: "Saved sample" },
              {
                value: "override",
                label: "Override here",
                disabled: !workbench.activeSourceSchema,
              },
            ]}
          />
        </Field>

        {workbench.runMode === "override" ? (
          <Field
            label="Override source payload"
            htmlFor="override-source-payload"
          >
            <Textarea
              id="override-source-payload"
              className="code-input review-input-editor"
              value={workbench.overrideSourceInput}
              onChange={(event) =>
                workbench.setOverrideSourceInput(event.target.value)
              }
              spellCheck={false}
            />
          </Field>
        ) : (
          <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground">
            <PlaySquare size={16} />
            <span>{sampleLabel}</span>
          </div>
        )}
      </div>

      <StatusAlert
        icon={<FileText size={16} />}
        title="Run input"
        description={
          workbench.runMode === "override"
            ? "Review will parse and run the override payload."
            : `Review will run ${sampleLabel}.`
        }
      />
    </WorkbenchCard>
  )
}
