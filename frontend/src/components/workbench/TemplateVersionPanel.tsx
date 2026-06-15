import { Download, History, RefreshCw, Save, Split } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { MappingTemplate } from "@/types/mapping"

type Props = {
  templates: MappingTemplate[]
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
  onLoadTemplate: (templateId: string, version?: number) => void
  onRefreshTemplates: () => void
}

export function TemplateVersionPanel({
  templates,
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
          <h2>Mapping templates</h2>
        </div>
        <History size={18} className="text-muted-foreground" />
      </div>

      <div className="template-stack">
        <label className="field-stack" htmlFor="template-name">
          <span>Name</span>
          <Input
            id="template-name"
            value={templateName}
            onChange={(event) => onTemplateNameChange(event.target.value)}
            placeholder="Shipment status map"
          />
        </label>

        <label className="field-stack" htmlFor="template-description">
          <span>Description</span>
          <Textarea
            id="template-description"
            value={templateDescription}
            onChange={(event) => onTemplateDescriptionChange(event.target.value)}
            placeholder="Reusable partner mapping notes"
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
          <p className="empty-line">Save a mapping or select an existing template.</p>
        )}
      </div>
    </section>
  )
}
