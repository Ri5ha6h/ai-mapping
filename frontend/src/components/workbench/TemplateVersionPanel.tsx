import { Download, History, RefreshCw, RotateCcw, Save, Split, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { MappingTemplate } from "@/types/mapping"

type Props = {
  templates: MappingTemplate[]
  deletedTemplates: MappingTemplate[]
  activeTemplate: MappingTemplate | null
  selectedTemplateId: string
  templateName: string
  templateDescription: string
  canSave: boolean
  busyAction: string | null
  onTemplateNameChange: (value: string) => void
  onTemplateDescriptionChange: (value: string) => void
  onSelectedTemplateChange: (templateId: string) => void
  onSaveTemplate: () => void
  onCreateVersion: () => void
  onDeleteTemplate: (templateId: string) => void
  onRestoreTemplate: (templateId: string) => void
  onLoadTemplate: (templateId: string, version?: number) => void
  onRefreshTemplates: () => void
}

export function TemplateVersionPanel({
  templates,
  deletedTemplates,
  activeTemplate,
  selectedTemplateId,
  templateName,
  templateDescription,
  canSave,
  busyAction,
  onTemplateNameChange,
  onTemplateDescriptionChange,
  onSelectedTemplateChange,
  onSaveTemplate,
  onCreateVersion,
  onDeleteTemplate,
  onRestoreTemplate,
  onLoadTemplate,
  onRefreshTemplates,
}: Props) {
  const selectedTemplate = templates.find((template) => template.template_id === selectedTemplateId) ?? activeTemplate
  const exampleTemplates = templates.filter((template) => template.is_seeded)
  const savedTemplates = templates.filter((template) => !template.is_seeded)
  const busy = Boolean(busyAction)

  return (
    <section className="tool-panel template-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Save</p>
          <h2>Script templates</h2>
        </div>
        <History size={18} className="text-muted-foreground" />
      </div>

      <div className="template-stack">
        {activeTemplate ? (
          <div className="active-template-strip">
            <History size={16} />
            <div>
              <strong>{activeTemplate.name} v{activeTemplate.active_version} is in use</strong>
              <span>Loading a version copies its script, samples, schema snapshots, validation results, and field validation rules into the current mapping workspace.</span>
            </div>
          </div>
        ) : null}

        <div className="template-note version-helper-note">
          <strong>How versions work</strong>
          <span>Save template updates the selected template name and notes. New version stores a fresh script, samples, schema snapshots, and field validation rules so older versions remain reproducible.</span>
        </div>

        <label className="field-stack" htmlFor="template-name">
          <span>Name</span>
          <Input
            id="template-name"
            value={templateName}
            onChange={(event) => onTemplateNameChange(event.target.value)}
            placeholder="Shipment transform"
          />
        </label>

        <label className="field-stack" htmlFor="template-description">
          <span>Description</span>
          <Textarea
            id="template-description"
            value={templateDescription}
            onChange={(event) => onTemplateDescriptionChange(event.target.value)}
            placeholder="Reusable transform notes"
            rows={3}
          />
        </label>

        <div className="template-actions">
          <Button type="button" onClick={onSaveTemplate} disabled={!canSave || busy || templateName.trim().length === 0}>
            <Save size={15} />
            Save template
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCreateVersion}
            disabled={!canSave || busy || !selectedTemplate}
          >
            <Split size={15} />
            New version
          </Button>
          <Button type="button" variant="outline" onClick={onRefreshTemplates} disabled={busy} title="Refresh templates">
            <RefreshCw size={15} />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => selectedTemplate ? onDeleteTemplate(selectedTemplate.template_id) : undefined}
            disabled={busy || !selectedTemplate || selectedTemplate.is_seeded}
            title="Archive selected template"
          >
            <Trash2 size={15} />
            Archive
          </Button>
        </div>

        <label className="field-stack">
          <span>Templates</span>
          <select
            value={selectedTemplateId}
            onChange={(event) => onSelectedTemplateChange(event.target.value)}
            className="template-select"
          >
            <option value="">No template selected</option>
            {exampleTemplates.length > 0 ? (
              <optgroup label="Examples">
                {exampleTemplates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>
                    {template.name} v{template.active_version}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {savedTemplates.length > 0 ? (
              <optgroup label="Saved">
                {savedTemplates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>
                    {template.name} v{template.active_version}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        {selectedTemplate?.is_seeded ? (
          <div className="template-note">
            <strong>Example</strong>
            <span>Includes source and target samples.</span>
          </div>
        ) : null}

        {selectedTemplate ? (
          <div className="version-list">
            {selectedTemplate.versions
              .slice()
              .sort((left, right) => right.version - left.version)
              .map((version) => (
                <div className="version-row" key={`${selectedTemplate.template_id}-${version.version}`}>
                  <div>
                    <strong>Version {version.version}</strong>
                    <span>
                      {version.source_format} to {version.target_format}
                      {version.sample_source_content ? " with samples" : ""}
                    </span>
                    <span className="template-engine-note">
                      JavaScript · {version.mapping_spec.script.length} chars
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onLoadTemplate(selectedTemplate.template_id, version.version)}
                    disabled={busy}
                  >
                    <Download size={14} />
                    Load
                  </Button>
                </div>
              ))}
          </div>
        ) : (
          <p className="empty-line">Save a script or select an existing template.</p>
        )}

        <div className="archive-panel">
          <div className="schema-list-heading">
            <strong>Archive & Trash</strong>
            <span>{deletedTemplates.length} archived templates</span>
          </div>
          {deletedTemplates.length === 0 ? (
            <p className="empty-line">Archived mapping templates will appear here for restore.</p>
          ) : (
            <div className="archive-card-list">
              {deletedTemplates.map((template) => (
                <div className="archive-row" key={template.template_id}>
                  <div>
                    <strong>{template.name}</strong>
                    <span>v{template.active_version} · {template.versions.length} version(s)</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRestoreTemplate(template.template_id)}
                    disabled={busy}
                  >
                    <RotateCcw size={14} />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
