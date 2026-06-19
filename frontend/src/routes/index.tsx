import { useEffect, useRef, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { createFileRoute } from "@tanstack/react-router"

import { MappingSchemaPanel } from "@/components/workbench/MappingSchemaPanel"
import { MappingSuggestionPanel } from "@/components/workbench/MappingSuggestionPanel"
import { OutputDiffPanel } from "@/components/workbench/OutputDiffPanel"
import { OutputPreview } from "@/components/workbench/OutputPreview"
import { RunLogsPanel } from "@/components/workbench/RunLogsPanel"
import { RunReviewPanel } from "@/components/workbench/RunReviewPanel"
import { SchemaViewer } from "@/components/workbench/SchemaViewer"
import { SchemaLibraryPanel } from "@/components/workbench/SchemaLibraryPanel"
import { ScriptWorkbench } from "@/components/workbench/ScriptWorkbench"
import { TemplateVersionPanel } from "@/components/workbench/TemplateVersionPanel"
import { ValidationPanel } from "@/components/workbench/ValidationPanel"
import { DisclosurePanel } from "@/components/workbench/DisclosurePanel"
import { WorkflowStep } from "@/components/workbench/WorkflowStep"
import { useMappingWorkbenchController } from "@/components/workbench/useMappingWorkbenchController"
import { useSchemaLibraryController } from "@/components/workbench/useSchemaLibraryController"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({ component: MappingWorkbench })

function MappingWorkbench() {
  const schemaLibrary = useSchemaLibraryController()
  const workbench = useMappingWorkbenchController({
    sourceSchemas: schemaLibrary.sourceSchemas,
    targetSchemas: schemaLibrary.targetSchemas,
  })
  const [activeTab, setActiveTab] = useState<"schema" | "mapping">("schema")
  const newMappingDialogRef = useRef<HTMLDialogElement>(null)
  const contextStatus =
    activeTab === "schema"
      ? `${schemaLibrary.sourceSchemas.length} source / ${schemaLibrary.targetSchemas.length} target schemas`
      : workbench.statusText

  useEffect(() => {
    const dialog = newMappingDialogRef.current
    if (!dialog) return
    if (workbench.newMappingPrompt.open && !dialog.open) {
      dialog.showModal()
      return
    }
    if (!workbench.newMappingPrompt.open && dialog.open) {
      dialog.close()
    }
  }, [workbench.newMappingPrompt.open])

  return (
    <main className="workbench-shell">
      <header className="workbench-header">
        <div>
          <p className="eyebrow">Auto Mapping POC</p>
          <h1>Integration Workbench</h1>
        </div>
        <div className="context-status" aria-live="polite">{contextStatus}</div>
      </header>

      {workbench.issue ? (
        <div className="issue-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>{workbench.issue.title}</strong>
            <span>{workbench.issue.detail}</span>
          </div>
        </div>
      ) : null}

      <div className="workbench-tabs" role="tablist" aria-label="Workbench tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "schema"}
          className={activeTab === "schema" ? "active" : ""}
          onClick={() => setActiveTab("schema")}
        >
          Schema
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "mapping"}
          className={activeTab === "mapping" ? "active" : ""}
          onClick={() => setActiveTab("mapping")}
        >
          Mapping
        </button>
      </div>

      <dialog
        ref={newMappingDialogRef}
        aria-labelledby="new-mapping-title"
        className="confirm-dialog"
        onCancel={workbench.cancelNewMapping}
      >
        <div>
          <p className="panel-kicker">Unsaved work</p>
          <h2 id="new-mapping-title">Start a new mapping?</h2>
          <p>
            Save this transform as a template before clearing the source, target, script, output, and validation state.
          </p>
        </div>
        <div className="dialog-actions">
          <Button
            type="button"
            onClick={() => void workbench.saveAndStartNewMapping()}
            disabled={!workbench.readyForTemplateSave || workbench.newMappingPrompt.pending}
          >
            {workbench.newMappingPrompt.pending ? <Loader2 className="animate-spin" /> : null}
            Save template
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={workbench.discardAndStartNewMapping}
            disabled={workbench.newMappingPrompt.pending}
          >
            Discard
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={workbench.cancelNewMapping}
            disabled={workbench.newMappingPrompt.pending}
          >
            Cancel
          </Button>
        </div>
      </dialog>

      {activeTab === "schema" ? (
        <SchemaLibraryPanel library={schemaLibrary} />
      ) : (
        <div className="workflow-stage-list">
          <WorkflowStep
            step={1}
            title="Setup"
            status={workbench.readyForMapping ? "Schema pair ready" : "Choose source and target schemas"}
            blocker={workbench.readyForMapping ? null : "Select or create a source and target schema before generating hints or scripts."}
          >
            <MappingSchemaPanel
              workbench={workbench}
              sourceSchemas={schemaLibrary.sourceSchemas}
              targetSchemas={schemaLibrary.targetSchemas}
              onOpenSchemaTab={() => setActiveTab("schema")}
            />
          </WorkflowStep>

          <WorkflowStep
            step={2}
            title="Author"
            status={workbench.readyForTransform ? "Script ready to run" : workbench.autoMapStatusText}
            blocker={workbench.providerErrors.length > 0 ? workbench.providerErrors[0] : null}
            secondary={
              <DisclosurePanel title="Field hints and schema fields" summary="Source, target, and provider details">
                <div className="schema-grid compact-detail-grid">
                  <SchemaViewer title="Source fields" schema={workbench.sourceSchema} />
                  <SchemaViewer title="Target fields" schema={workbench.targetSchema} />
                  <MappingSuggestionPanel
                    suggestions={workbench.suggestions}
                    usedAi={workbench.usedAi}
                    statusText={workbench.autoMapStatusText}
                    providerErrors={workbench.providerErrors}
                  />
                </div>
              </DisclosurePanel>
            }
          >
            <ScriptWorkbench
              script={workbench.script}
              explanation={workbench.draftExplanation}
              unresolvedPaths={workbench.unresolvedTargetPaths}
              sourceReference={workbench.sourceReference}
              sourceFormat={workbench.sourceFormat}
              statusText={workbench.statusText}
              autoMapMode={workbench.autoMapMode}
              aiMappingAvailable={workbench.aiMappingAvailable}
              canGenerate={workbench.readyForMapping}
              busyAction={workbench.busyAction}
              onScriptChange={workbench.setScript}
              onGenerate={() => void workbench.generateScript()}
              onFieldHints={() => void workbench.autoMap()}
              onAutoMapModeChange={workbench.setAutoMapMode}
            />
          </WorkflowStep>

          <WorkflowStep
            step={3}
            title="Review"
            status={workbench.transformResult ? "Output ready for validation" : "Run the script to review output"}
            blocker={workbench.validationErrors.length > 0 ? `${workbench.validationErrors.length} validation issue(s) need review.` : null}
            secondary={
              <DisclosurePanel title="Diff and raw logs" summary="Secondary run diagnostics">
                <div className="result-grid compact-detail-grid">
                  <OutputDiffPanel
                    diffs={workbench.outputDiff}
                    outputFormat={workbench.targetFormat}
                    hasRun={Boolean(workbench.transformResult)}
                  />
                  <RunLogsPanel logs={workbench.transformResult?.logs ?? []} />
                </div>
              </DisclosurePanel>
            }
          >
            <div className="result-grid review-primary-grid">
              <RunReviewPanel workbench={workbench} />
              <OutputPreview result={workbench.transformResult} />
              <ValidationPanel errors={workbench.validationErrors} outputFormat={workbench.targetFormat} />
            </div>
          </WorkflowStep>

          <WorkflowStep
            step={4}
            title="Save"
            status={workbench.readyForTemplateSave ? "Template can be saved" : "Run a valid script before saving"}
          >
            <TemplateVersionPanel
              templates={workbench.templates}
              deletedTemplates={workbench.deletedTemplates}
              activeTemplate={workbench.activeTemplate}
              selectedTemplateId={workbench.selectedTemplateId}
              templateName={workbench.templateName}
              templateDescription={workbench.templateDescription}
              canSave={workbench.readyForTemplateSave}
              busyAction={workbench.busyAction}
              onTemplateNameChange={workbench.setTemplateName}
              onTemplateDescriptionChange={workbench.setTemplateDescription}
              onSelectedTemplateChange={workbench.selectTemplate}
              onSaveTemplate={() => void workbench.saveTemplate()}
              onCreateVersion={() => void workbench.saveTemplateVersion()}
              onDeleteTemplate={(templateId) => void workbench.deleteTemplate(templateId)}
              onRestoreTemplate={(templateId) => void workbench.restoreTemplate(templateId)}
              onLoadTemplate={(templateId, version) => void workbench.loadTemplate(templateId, version)}
              onRefreshTemplates={() => void workbench.refreshTemplates()}
            />
          </WorkflowStep>
        </div>
      )}
    </main>
  )
}
