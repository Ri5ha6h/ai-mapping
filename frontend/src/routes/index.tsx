import { useState } from "react"
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
import { Kicker, StatusAlert, StatusBadge } from "@/components/workbench/ui"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/")({ component: MappingWorkbench })

function MappingWorkbench() {
  const schemaLibrary = useSchemaLibraryController()
  const workbench = useMappingWorkbenchController({
    sourceSchemas: schemaLibrary.sourceSchemas,
    targetSchemas: schemaLibrary.targetSchemas,
  })
  const [activeTab, setActiveTab] = useState<"schema" | "mapping">("schema")
  const contextStatus =
    activeTab === "schema"
      ? `${schemaLibrary.sourceSchemas.length} source / ${schemaLibrary.targetSchemas.length} target schemas`
      : workbench.statusText

  return (
    <main className="workbench-shell min-h-screen bg-background p-4 sm:p-5">
      <header className="mx-auto mb-5 flex max-w-[1800px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Kicker>Auto Mapping POC</Kicker>
          <h1 className="text-3xl leading-none font-bold tracking-normal text-foreground sm:text-5xl">
            Integration Workbench
          </h1>
        </div>
        <StatusBadge className="h-9 rounded-lg px-3 text-sm" aria-live="polite">
          {contextStatus}
        </StatusBadge>
      </header>

      {workbench.issue ? (
        <StatusAlert
          className="mx-auto mb-4 max-w-[1800px]"
          icon={<ShieldCheck size={18} />}
          title={workbench.issue.title}
          description={workbench.issue.detail}
        />
      ) : null}

      <Dialog
        open={workbench.newMappingPrompt.open}
        onOpenChange={(open) => {
          if (!open) workbench.cancelNewMapping()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <Kicker>Unsaved work</Kicker>
            <DialogTitle>Start a new mapping?</DialogTitle>
            <DialogDescription>
              Save this transform as a template before clearing the source,
              target, script, output, and validation state.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void workbench.saveAndStartNewMapping()}
              disabled={
                !workbench.readyForTemplateSave ||
                workbench.newMappingPrompt.pending
              }
            >
              {workbench.newMappingPrompt.pending ? (
                <Loader2 className="animate-spin" />
              ) : null}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "schema" | "mapping")}
        className="mx-auto max-w-[1800px]"
      >
        <TabsList variant="line" className="mb-4 border-b">
          <TabsTrigger value="schema" className="min-w-28">
            Schema
          </TabsTrigger>
          <TabsTrigger value="mapping" className="min-w-28">
            Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schema">
          <SchemaLibraryPanel library={schemaLibrary} />
        </TabsContent>

        <TabsContent value="mapping">
          <div className="workflow-stage-list">
            <WorkflowStep
              step={1}
              title="Setup"
              status={
                workbench.readyForMapping
                  ? "Schema pair ready"
                  : "Choose source and target schemas"
              }
              blocker={
                workbench.readyForMapping
                  ? null
                  : "Select or create a source and target schema before generating hints or scripts."
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void workbench.startNewMapping()}
                  disabled={Boolean(workbench.busyAction)}
                >
                  New Mapping
                </Button>
              }
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
              status={
                workbench.readyForTransform
                  ? "Script ready to run"
                  : workbench.autoMapStatusText
              }
              blocker={
                workbench.providerErrors.length > 0
                  ? workbench.providerErrors[0]
                  : null
              }
              secondary={
                <DisclosurePanel
                  title="Field hints and schema fields"
                  summary="Source, target, and provider details"
                >
                  <div className="schema-grid compact-detail-grid">
                    <SchemaViewer
                      title="Source fields"
                      schema={workbench.sourceSchema}
                    />
                    <SchemaViewer
                      title="Target fields"
                      schema={workbench.targetSchema}
                    />
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
              status={
                workbench.transformResult
                  ? "Output ready for validation"
                  : "Run the script to review output"
              }
              blocker={
                workbench.validationErrors.length > 0
                  ? `${workbench.validationErrors.length} validation issue(s) need review.`
                  : null
              }
              secondary={
                <DisclosurePanel
                  title="Diff and raw logs"
                  summary="Secondary run diagnostics"
                >
                  <div className="result-grid compact-detail-grid">
                    <OutputDiffPanel
                      diffs={workbench.outputDiff}
                      outputFormat={workbench.targetFormat}
                      hasRun={Boolean(workbench.transformResult)}
                    />
                    <RunLogsPanel
                      logs={workbench.transformResult?.logs ?? []}
                    />
                  </div>
                </DisclosurePanel>
              }
            >
              <div className="result-grid review-primary-grid">
                <RunReviewPanel workbench={workbench} />
                <OutputPreview result={workbench.transformResult} />
                <ValidationPanel
                  errors={workbench.validationErrors}
                  outputFormat={workbench.targetFormat}
                />
              </div>
            </WorkflowStep>

            <WorkflowStep
              step={4}
              title="Save"
              status={
                workbench.readyForTemplateSave
                  ? "Template can be saved"
                  : "Run a valid script before saving"
              }
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
                onDeleteTemplate={(templateId) =>
                  void workbench.deleteTemplate(templateId)
                }
                onRestoreTemplate={(templateId) =>
                  void workbench.restoreTemplate(templateId)
                }
                onLoadTemplate={(templateId, version) =>
                  void workbench.loadTemplate(templateId, version)
                }
                onRefreshTemplates={() => void workbench.refreshTemplates()}
              />
            </WorkflowStep>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}
