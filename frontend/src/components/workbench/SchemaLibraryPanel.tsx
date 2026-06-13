import {
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"

import { SchemaViewer } from "@/components/workbench/SchemaViewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { SourceFormat } from "@/types/mapping"
import type { SchemaArtifact } from "@/types/schema"
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
    <div className="schema-workspace">
      {library.issue ? (
        <div className="issue-banner">
          <FileText size={18} />
          <div>
            <strong>{library.issue.title}</strong>
            <span>{library.issue.detail}</span>
          </div>
        </div>
      ) : null}

      <section className="tool-panel schema-create-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Schema</p>
            <h2>Create schema artifact</h2>
          </div>
          <label className="icon-button" title="Upload schema sample">
            <Upload size={16} />
            <input
              className="hidden"
              type="file"
              onChange={(event) =>
                void library.useUploadedFile(event.currentTarget.files?.[0])
              }
            />
          </label>
        </div>

        <div className="schema-form-grid">
          <label className="field-stack">
            <span>Name</span>
            <Input
              value={library.draft.name}
              onChange={(event) =>
                library.updateDraft({ name: event.target.value })
              }
            />
          </label>
          <label className="field-stack">
            <span>Description</span>
            <Input
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

        <Textarea
          className="code-input min-h-72"
          value={library.draft.content}
          onChange={(event) => library.usePastedContent(event.target.value)}
          spellCheck={false}
        />

        <div className="schema-create-footer">
          <SchemaDraftMeta library={library} />
          <Button
            type="button"
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
        </div>
      </section>

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
        <div className="schema-library-columns">
          <SchemaList
            title="Source"
            schemas={library.sourceSchemas}
            selectedSchemaId={library.selectedSchemaId}
            onSelect={library.setSelectedSchemaId}
          />
          <SchemaList
            title="Target"
            schemas={library.targetSchemas}
            selectedSchemaId={library.selectedSchemaId}
            onSelect={library.setSelectedSchemaId}
          />
        </div>
      </section>

      <SchemaDetailPanel library={library} />
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
        {library.draft.originalFilename} · {formatBytes(library.draft.originalSize)}
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
