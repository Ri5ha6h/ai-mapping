import { Clipboard, Database, FileText, Loader2, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react"

import { SchemaViewer } from "@/components/workbench/SchemaViewer"
import { WorkflowStep } from "@/components/workbench/WorkflowStep"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { flattenSchema } from "@/lib/effect/schemas"
import type { SourceFormat } from "@/types/mapping"
import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import type { useSchemaLibraryController } from "./useSchemaLibraryController"

type Props = {
  library: ReturnType<typeof useSchemaLibraryController>
}

const sourceFormats: Array<{ value: SourceFormat; label: string }> = [
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "edi_214", label: "EDI 214" },
  { value: "edi_856", label: "EDI 856" },
]

const targetFormats = sourceFormats.filter((format) =>
  ["json", "xml"].includes(format.value)
)

export function SchemaLibraryPanel({ library }: Props) {
  const formatOptions =
    library.draft.direction === "target" ? targetFormats : sourceFormats

  return (
    <div className="workflow-stage-list schema-workflow">
      {library.issue ? (
        <div className="issue-banner">
          <FileText size={18} />
          <div>
            <strong>{library.issue.title}</strong>
            <span>{library.issue.detail}</span>
          </div>
        </div>
      ) : null}

      <WorkflowStep
        step={1}
        title="Create"
        status={library.canCreateSchema ? "Ready to create schema" : "Paste or upload a schema sample"}
      >
        <section className="tool-panel schema-create-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Create</p>
              <h2>Schema artifact</h2>
            </div>
          </div>

          <div className="schema-form-grid">
            <label className="field-stack" htmlFor="schema-artifact-name">
              <span>Name</span>
              <Input
                id="schema-artifact-name"
                value={library.draft.name}
                onChange={(event) =>
                  library.updateDraft({ name: event.target.value })
                }
              />
            </label>
            <label className="field-stack" htmlFor="schema-artifact-description">
              <span>Description</span>
              <Input
                id="schema-artifact-description"
                value={library.draft.description}
                onChange={(event) =>
                  library.updateDraft({ description: event.target.value })
                }
              />
            </label>
          </div>

          <div className="schema-control-grid">
            <SegmentedSchemaControl
              label="Direction"
              value={library.draft.direction}
              options={[
                { value: "source", label: "Source" },
                { value: "target", label: "Target" },
              ]}
              onChange={(direction) => library.updateDraft({ direction })}
            />
            <SegmentedSchemaControl
              label="Format"
              value={library.draft.format}
              options={formatOptions}
              onChange={(format) => library.updateDraft({ format })}
            />
          </div>

          <InputModeControl library={library} />

          {library.draft.inputMethod === "upload" ? (
            <UploadDraftPanel library={library} />
          ) : (
            <Textarea
              className="code-input schema-content-editor"
              value={library.draft.content}
              onChange={(event) => library.usePastedContent(event.target.value)}
              spellCheck={false}
            />
          )}

          <SchemaDraftMeta library={library} />

          <Button
            type="button"
            className="schema-create-action"
            onClick={() => void library.createSchema()}
            disabled={!library.canCreateSchema}
          >
            {library.busyAction === "Creating schema" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Database />
            )}
            Create schema
          </Button>
        </section>
      </WorkflowStep>

      <WorkflowStep
        step={2}
        title="Library & Detail"
        status={library.selectedSchema ? `Selected ${library.selectedSchema.name}` : "Select a saved schema to inspect"}
      >
        <div className="schema-library-detail-grid">
          <section className="tool-panel schema-library-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Library</p>
                <h2>Saved schemas</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Refresh schemas"
                onClick={() => void library.refreshSchemas()}
                disabled={Boolean(library.busyAction)}
              >
                {library.busyAction === "Loading schemas" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
              </Button>
            </div>
            <SegmentedSchemaControl
              label="Schema type"
              value={library.selectedLibraryDirection}
              options={[
                { value: "source", label: "Source" },
                { value: "target", label: "Target" },
              ]}
              onChange={library.setSelectedLibraryDirection}
            />
            <SchemaList
              title={library.selectedLibraryDirection === "source" ? "Source" : "Target"}
              schemas={library.selectedLibraryDirection === "source" ? library.sourceSchemas : library.targetSchemas}
              selectedSchemaId={library.selectedSchemaId}
              onSelect={library.setSelectedSchemaId}
            />
          </section>

          <SchemaDetailPanel library={library} />
        </div>
        <SchemaArchivePanel library={library} />
      </WorkflowStep>
    </div>
  )
}

function SchemaArchivePanel({ library }: Props) {
  return (
    <section className="archive-panel">
      <div className="schema-list-heading">
        <strong>Archive & Trash</strong>
        <span>{library.deletedSchemas.length} archived schemas</span>
      </div>
      {library.deletedSchemas.length === 0 ? (
        <p className="empty-line">Deleted schemas will appear here for restore.</p>
      ) : (
        <div className="archive-card-list">
          {library.deletedSchemas.map((schema) => (
            <div className="archive-row" key={schema.schema_id}>
              <div>
                <strong>{schema.name}</strong>
                <span>{schema.direction} · {schema.format.toUpperCase()}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void library.restoreSchema(schema.schema_id)}
                disabled={Boolean(library.busyAction)}
              >
                {library.busyAction === "Restoring schema" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RotateCcw />
                )}
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function InputModeControl({ library }: Props) {
  return (
    <div className="field-stack">
      <span>Input mode</span>
      <div className="schema-segmented-control schema-input-mode">
        <button
          type="button"
          className={library.draft.inputMethod === "paste" ? "active" : ""}
          onClick={() => library.usePastedContent(library.draft.content)}
        >
          <Clipboard size={14} />
          Paste
        </button>
        <label
          className={library.draft.inputMethod === "upload" ? "active" : ""}
          title="Upload schema sample"
        >
          <Upload size={14} />
          Upload
          <input
            className="hidden"
            type="file"
            onChange={(event) =>
              void library.useUploadedFile(event.currentTarget.files?.[0])
            }
          />
        </label>
      </div>
    </div>
  )
}

function UploadDraftPanel({ library }: Props) {
  return (
    <div className="schema-upload-panel">
      <label className="schema-upload-dropzone">
        <Upload size={18} />
        <strong>
          {library.draft.originalFilename ?? "Choose a text schema sample"}
        </strong>
        <span>JSON, XML, EDI 214, and EDI 856 samples are read as text.</span>
        <input
          className="hidden"
          type="file"
          onChange={(event) =>
            void library.useUploadedFile(event.currentTarget.files?.[0])
          }
        />
      </label>

      {library.draft.content ? (
        <div className="schema-upload-preview">
          <div className="schema-list-heading">
            <strong>Uploaded content preview</strong>
            <span>{formatBytes(library.draft.originalSize)}</span>
          </div>
          <pre className="preview-block">{library.draft.content}</pre>
        </div>
      ) : null}
    </div>
  )
}

function SegmentedSchemaControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: TValue
  options: Array<{ value: TValue; label: string }>
  onChange: (value: TValue) => void
}) {
  return (
    <div className="field-stack">
      <span>{label}</span>
      <div className="schema-segmented-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SchemaDraftMeta({ library }: Props) {
  if (library.draft.inputMethod === "upload" && library.draft.originalFilename) {
    return (
      <p className="schema-meta-line">
        {library.draft.originalFilename} ·{" "}
        {library.draft.originalContentType || "text/plain"} ·{" "}
        {formatBytes(library.draft.originalSize)}
      </p>
    )
  }
  return <p className="schema-meta-line">Pasted text will be preserved verbatim.</p>
}

function SchemaList({
  title,
  schemas,
  selectedSchemaId,
  onSelect,
}: {
  title: string
  schemas: SchemaArtifact[]
  selectedSchemaId: string
  onSelect: (schemaId: string) => void
}) {
  return (
    <div className="schema-library-column">
      <div className="schema-list-heading">
        <strong>{title}</strong>
        <span>{schemas.length}</span>
      </div>
      <div className="schema-card-list">
        {schemas.length === 0 ? (
          <p className="empty-line">No saved {title.toLowerCase()} schemas.</p>
        ) : (
          schemas.map((schema) => (
            <button
              key={schema.schema_id}
              type="button"
              className={
                selectedSchemaId === schema.schema_id
                  ? "schema-card active"
                  : "schema-card"
              }
              onClick={() => onSelect(schema.schema_id)}
            >
              <strong>{schema.name}</strong>
              <span>
                {schema.format.toUpperCase()} · {formatBytes(schema.original_size)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function SchemaDetailPanel({ library }: Props) {
  const schema = library.selectedSchema

  if (!schema) {
    return (
      <section className="tool-panel schema-detail-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Inspect</p>
            <h2>Schema detail</h2>
          </div>
        </div>
        <p className="empty-line">Select a saved schema to inspect it.</p>
      </section>
    )
  }

  return (
    <section className="tool-panel schema-detail-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">{schema.direction}</p>
          <h2>{schema.name}</h2>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          title="Delete schema"
          onClick={() => void library.deleteSelectedSchema()}
          disabled={Boolean(library.busyAction)}
        >
          {library.busyAction === "Deleting schema" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Trash2 />
          )}
        </Button>
      </div>
      {schema.description ? (
        <p className="schema-description">{schema.description}</p>
      ) : null}
      <div className="schema-detail-stats">
        <span>{schema.format.toUpperCase()}</span>
        <span>{formatBytes(schema.original_size)}</span>
        <span>{schema.input_method}</span>
      </div>
      <SchemaViewer title="Inferred fields" schema={schema.inferred_schema} />
      {schema.direction === "target" ? (
        <TargetValidationRules library={library} schema={schema.inferred_schema} />
      ) : null}
      <div className="schema-preview-grid">
        <PreviewBlock
          title="Canonical sample"
          value={JSON.stringify(schema.canonical_sample, null, 2)}
        />
        <PreviewBlock title="Original content" value={schema.original_content} />
      </div>
    </section>
  )
}

function TargetValidationRules({ library, schema }: Props & { schema: SchemaNode }) {
  const fields = flattenSchema(schema).filter((field) => field.path !== "$")

  if (fields.length === 0) return null

  return (
    <section className="target-validation-draft">
      <div className="schema-list-heading">
        <strong>Target field validation rules</strong>
        <span>
          {library.selectedTargetRules.length} saved rules
          {library.dirtyTargetRulePaths.length > 0 ? ` · ${library.dirtyTargetRulePaths.length} unsaved` : ""}
        </span>
      </div>
      <div className="validation-draft-list">
        {fields.slice(0, 12).map((field) => (
          <FieldRuleRow
            key={field.path}
            field={field}
            savedRule={library.selectedTargetRules.find((rule) => rule.path === field.path)}
            draftRule={library.targetRuleDrafts[field.path]}
            dirty={library.dirtyTargetRulePaths.includes(field.path)}
            saving={library.busyAction === "Saving field rule"}
            onUpdate={(patch) => void library.updateFieldRule(field.path, patch)}
          />
        ))}
      </div>
      <Button
        type="button"
        className="target-validation-save"
        onClick={() => void library.saveFieldRules()}
        disabled={library.dirtyTargetRulePaths.length === 0 || Boolean(library.busyAction)}
      >
        {library.busyAction === "Saving field rule" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Database />
        )}
        Save validation rules
      </Button>
      <p className="schema-meta-line">
        Edits stay local until saved. Saved rules are used by mapping runs for this target schema.
      </p>
    </section>
  )
}

function FieldRuleRow({
  field,
  savedRule,
  draftRule,
  dirty,
  saving,
  onUpdate,
}: {
  field: ReturnType<typeof flattenSchema>[number]
  savedRule: Props["library"]["selectedTargetRules"][number] | undefined
  draftRule: Props["library"]["targetRuleDrafts"][string] | undefined
  dirty: boolean
  saving: boolean
  onUpdate: (patch: Parameters<Props["library"]["updateFieldRule"]>[1]) => void
}) {
  const valueType = draftRule?.value_type ?? savedRule?.value_type ?? field.type
  const required = draftRule?.required ?? savedRule?.required ?? false
  const minValue = ruleBoundValue(draftRule, savedRule, "min")
  const maxValue = ruleBoundValue(draftRule, savedRule, "max")

  return (
    <div className="validation-draft-row">
      <span title={field.path}>{field.path}</span>
      <select
        value={valueType}
        aria-label={`${field.path} type`}
        disabled={saving}
        onChange={(event) => onUpdate({ ...draftBase(field.path, event.target.value, required), value_type: event.target.value })}
      >
              {validationTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
      </select>
      <label>
        <input
          type="checkbox"
          checked={required}
          disabled={saving}
          onChange={(event) => onUpdate({ ...draftBase(field.path, valueType, event.target.checked), required: event.target.checked })}
        />
        Required
      </label>
      <Input
        aria-label={`${field.path} min`}
        placeholder="Min"
        value={minValue}
        disabled={saving}
        onChange={(event) => onUpdate({ ...draftBase(field.path, valueType, required), ...minPatch(valueType, event.target.value) })}
      />
      <Input
        aria-label={`${field.path} max`}
        placeholder="Max"
        value={maxValue}
        disabled={saving}
        onChange={(event) => onUpdate({ ...draftBase(field.path, valueType, required), ...maxPatch(valueType, event.target.value) })}
      />
      <span className="schema-meta-line">{dirty ? "Unsaved" : savedRule ? "Saved" : "Default"}</span>
    </div>
  )
}

function ruleBoundValue(
  draftRule: Props["library"]["targetRuleDrafts"][string] | undefined,
  savedRule: Props["library"]["selectedTargetRules"][number] | undefined,
  bound: "min" | "max"
) {
  const valueKey = bound === "min" ? "min_value" : "max_value"
  const lengthKey = bound === "min" ? "min_length" : "max_length"
  if (draftRule) return draftRule[valueKey] ?? draftRule[lengthKey] ?? ""
  return savedRule?.[valueKey] ?? savedRule?.[lengthKey] ?? ""
}

function draftBase(path: string, valueType: string, required: boolean) {
  return {
    path,
    value_type: valueType,
    required,
  }
}

function minPatch(valueType: string, value: string) {
  const parsed = parseOptionalNumber(value)
  return usesLength(valueType)
    ? { min_length: parsed === null ? null : Math.max(0, Math.trunc(parsed)), min_value: null }
    : { min_value: parsed, min_length: null }
}

function maxPatch(valueType: string, value: string) {
  const parsed = parseOptionalNumber(value)
  return usesLength(valueType)
    ? { max_length: parsed === null ? null : Math.max(0, Math.trunc(parsed)), max_value: null }
    : { max_value: parsed, max_length: null }
}

function usesLength(valueType: string) {
  return valueType === "string" || valueType === "array"
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const validationTypes = ["string", "date", "number", "integer", "boolean", "object", "array", "mixed"]

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="schema-preview-block">
      <div className="schema-list-heading">
        <strong>{title}</strong>
      </div>
      <pre className="preview-block">{value}</pre>
    </div>
  )
}

function formatBytes(value: number | null) {
  if (value === null) return "0 B"
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(1)} KB`
}
