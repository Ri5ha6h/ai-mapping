import { Download, History, RefreshCw, RotateCcw, Save, Split, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { MappingTemplate } from "@/types/mapping"
import { Field, SelectField, StatusAlert, WorkbenchCard } from "./ui"

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
    <WorkbenchCard kicker="Save" title="Script templates" icon={<History size={18} />} className="template-panel">
      <div className="grid gap-3">
        {activeTemplate ? (
          <StatusAlert
            icon={<History size={16} />}
            title={`${activeTemplate.name} v${activeTemplate.active_version} is in use`}
            description="Loading a version copies its script, samples, schema snapshots, validation results, and field validation rules into the current mapping workspace."
          />
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2" aria-label="Template save options">
          <div className="rounded-lg border bg-muted/25 p-3">
            <strong>Save template</strong>
            <span className="block text-sm text-muted-foreground">Updates the selected template name, notes, and current workspace snapshot.</span>
          </div>
          <div className="rounded-lg border bg-muted/25 p-3">
            <strong>New version</strong>
            <span className="block text-sm text-muted-foreground">Adds a numbered snapshot while keeping older versions loadable.</span>
          </div>
        </div>

        <StatusAlert
          title="How versions work"
          description="Versions preserve script, samples, schema snapshots, validation results, and field validation rules so archive/restore or schema changes do not break prior mappings."
        />

        <Field label="Name" htmlFor="template-name">
          <Input
            id="template-name"
            value={templateName}
            onChange={(event) => onTemplateNameChange(event.target.value)}
            placeholder="Shipment transform"
          />
        </Field>

        <Field label="Description" htmlFor="template-description">
          <Textarea
            id="template-description"
            value={templateDescription}
            onChange={(event) => onTemplateDescriptionChange(event.target.value)}
            placeholder="Reusable transform notes"
            rows={3}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
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

        <SelectField
          label="Templates"
          value={selectedTemplateId}
          placeholder="No template selected"
          onValueChange={onSelectedTemplateChange}
          options={[
            { value: "", label: "No template selected" },
            ...exampleTemplates.map((template) => ({
              value: template.template_id,
              label: `Example: ${template.name} v${template.active_version}`,
            })),
            ...savedTemplates.map((template) => ({
              value: template.template_id,
              label: `Saved: ${template.name} v${template.active_version}`,
            })),
          ]}
        />

        {selectedTemplate?.is_seeded ? (
          <StatusAlert title="Example" description="Includes source and target samples." />
        ) : null}

        {selectedTemplate ? (
          <div className="grid gap-2">
            {selectedTemplate.versions
              .slice()
              .sort((left, right) => right.version - left.version)
              .map((version) => (
                <div className={[
                  "flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
                  version.version === selectedTemplate.active_version ? "border-primary bg-secondary/40" : "",
                ].join(" ")} key={`${selectedTemplate.template_id}-${version.version}`}>
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>Version {version.version}</strong>
                      {version.version === selectedTemplate.active_version ? <Badge>current</Badge> : null}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {version.source_format} to {version.target_format}
                      {version.sample_source_content ? " with samples" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      JavaScript · {version.mapping_spec.script.length} chars · {version.field_validation_rules.length} field rules
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
          <p className="text-sm text-muted-foreground">Save a script or select an existing template.</p>
        )}

        <div className="grid gap-3 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <strong>Archive & Trash</strong>
            <Badge variant="outline">{deletedTemplates.length} archived templates</Badge>
          </div>
          {deletedTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Archived mapping templates will appear here with restore controls.</p>
          ) : (
            <div className="grid gap-2">
              {deletedTemplates.map((template) => (
                <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between" key={template.template_id}>
                  <div className="grid min-w-0 gap-1">
                    <strong>{template.name}</strong>
                    <span className="text-sm text-muted-foreground">v{template.active_version} · {template.versions.length} version(s) · archived template</span>
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
    </WorkbenchCard>
  )
}
