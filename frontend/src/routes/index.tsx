import { useEffect, useRef } from "react"
import { Bot, FilePlus2, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react"
import { createFileRoute } from "@tanstack/react-router"

import { DemoScenarioPanel } from "@/components/workbench/DemoScenarioPanel"
import { JsonataEditor } from "@/components/workbench/JsonataEditor"
import { MappingSuggestionPanel } from "@/components/workbench/MappingSuggestionPanel"
import { OutputPreview } from "@/components/workbench/OutputPreview"
import { SchemaViewer } from "@/components/workbench/SchemaViewer"
import { SourceInputPanel } from "@/components/workbench/SourceInputPanel"
import { TargetInputPanel } from "@/components/workbench/TargetInputPanel"
import { TemplateVersionPanel } from "@/components/workbench/TemplateVersionPanel"
import { ValidationPanel } from "@/components/workbench/ValidationPanel"
import { VisualMappingEditor } from "@/components/workbench/VisualMappingEditor"
import {
  demoScenarios,
  useMappingWorkbenchController,
} from "@/components/workbench/useMappingWorkbenchController"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({ component: MappingWorkbench })

function MappingWorkbench() {
  const workbench = useMappingWorkbenchController()
  const newMappingDialogRef = useRef<HTMLDialogElement>(null)

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
          <h1>Mapping Workbench</h1>
        </div>
        <div className="run-bar">
          <span>{workbench.statusText}</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => void workbench.startNewMapping()}
            disabled={Boolean(workbench.busyAction)}
          >
            <FilePlus2 />
            New Mapping
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void workbench.parseAndInfer()}
            disabled={Boolean(workbench.busyAction)}
          >
            {workbench.busyAction === "Parsing samples" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Parse
          </Button>
          <div className="auto-map-mode" aria-label="Auto map mode">
            <button
              type="button"
              className={workbench.autoMapMode === "local" ? "active" : ""}
              onClick={() => workbench.setAutoMapMode("local")}
              disabled={Boolean(workbench.busyAction)}
            >
              Local
            </button>
            <button
              type="button"
              className={workbench.autoMapMode === "ai" ? "active" : ""}
              onClick={() => workbench.setAutoMapMode("ai")}
              disabled={Boolean(workbench.busyAction) || !workbench.aiMappingAvailable}
              title={workbench.aiMappingAvailable ? "Use OpenRouter-assisted suggestions" : "AI unavailable"}
            >
              AI-assisted
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void workbench.autoMap()}
            disabled={!workbench.readyForMapping || Boolean(workbench.busyAction)}
          >
            {workbench.busyAction === "Generating mappings" ? <Loader2 className="animate-spin" /> : <Bot />}
            Auto map
          </Button>
          <Button
            type="button"
            onClick={() => void workbench.runTransform()}
            disabled={!workbench.readyForTransform || Boolean(workbench.busyAction)}
          >
            {workbench.busyAction === "Running transformation" ? <Loader2 className="animate-spin" /> : <Play />}
            Run
          </Button>
        </div>
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
            Save this mapping as a template before clearing the source, target, rules, output, and validation state.
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

      <DemoScenarioPanel
        scenarios={demoScenarios}
        activeScenarioId={workbench.activeScenarioId}
        busyAction={workbench.busyAction}
        onSelect={workbench.loadScenario}
      />

      <div className="input-grid">
        <SourceInputPanel
          value={workbench.sourceInput}
          format={workbench.sourceFormat}
          onValueChange={workbench.handleSourceInputChange}
          onFormatChange={workbench.handleSourceFormatChange}
        />
        <TargetInputPanel
          value={workbench.targetInput}
          format={workbench.targetFormat}
          onValueChange={workbench.handleTargetInputChange}
          onFormatChange={workbench.handleTargetFormatChange}
        />
      </div>

      <div className="schema-grid">
        <SchemaViewer title="Source fields" schema={workbench.sourceSchema} />
        <SchemaViewer title="Target fields" schema={workbench.targetSchema} />
        <MappingSuggestionPanel
          suggestions={workbench.suggestions}
          usedAi={workbench.usedAi}
          statusText={workbench.autoMapStatusText}
          providerErrors={workbench.providerErrors}
        />
      </div>

      <div className="editor-grid">
        <VisualMappingEditor rules={workbench.rules} onRulesChange={workbench.setRules} />
        <JsonataEditor value={workbench.advancedJsonata} onChange={workbench.setAdvancedJsonata} />
      </div>

      <div className="result-grid">
        <OutputPreview result={workbench.transformResult} />
        <ValidationPanel errors={workbench.validationErrors} />
        <TemplateVersionPanel
          templates={workbench.templates}
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
          onLoadTemplate={(templateId, version) => void workbench.loadTemplate(templateId, version)}
          onRefreshTemplates={() => void workbench.refreshTemplates()}
        />
      </div>
    </main>
  )
}
