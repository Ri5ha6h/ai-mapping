import {
  Clipboard,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react"

import { SchemaViewer } from "@/components/workbench/SchemaViewer"
import { WorkflowStep } from "@/components/workbench/WorkflowStep"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { flattenSchema } from "@/lib/effect/schemas"
import type { SourceFormat } from "@/types/mapping"
import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import type { useSchemaLibraryController } from "./useSchemaLibraryController"
import {
  Field,
  SegmentedControl,
  SelectField,
  StatusAlert,
  WorkbenchCard,
} from "./ui"

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
        <StatusAlert
          icon={<FileText size={18} />}
          title={library.issue.title}
          description={library.issue.detail}
        />
      ) : null}

      <WorkflowStep
        step={1}
        title="Create"
        status={
          library.canCreateSchema
            ? "Ready to create schema"
            : "Paste or upload a schema sample"
        }
      >
        <WorkbenchCard
          kicker="Create"
          title="Schema artifact"
          className="schema-create-panel"
        >
          <div className="schema-form-grid">
            <Field label="Name" htmlFor="schema-artifact-name">
              <Input
                id="schema-artifact-name"
                value={library.draft.name}
                onChange={(event) =>
                  library.updateDraft({ name: event.target.value })
                }
              />
            </Field>
            <Field label="Description" htmlFor="schema-artifact-description">
              <Input
                id="schema-artifact-description"
                value={library.draft.description}
                onChange={(event) =>
                  library.updateDraft({ description: event.target.value })
                }
              />
            </Field>
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
        </WorkbenchCard>
      </WorkflowStep>

      <WorkflowStep
        step={2}
        title="Library & Detail"
        status={
          library.selectedSchema
            ? `Selected ${library.selectedSchema.name}`
            : "Select a saved schema to inspect"
        }
      >
        <div className="schema-library-detail-grid">
          <WorkbenchCard
            kicker="Library"
            title="Saved schemas"
            className="schema-library-panel"
            action={
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
            }
          >
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
              title={
                library.selectedLibraryDirection === "source"
                  ? "Source"
                  : "Target"
              }
              schemas={
                library.selectedLibraryDirection === "source"
                  ? library.sourceSchemas
                  : library.targetSchemas
              }
              selectedSchemaId={library.selectedSchemaId}
              onSelect={library.setSelectedSchemaId}
            />
          </WorkbenchCard>

          <SchemaDetailPanel library={library} />
        </div>
        <SchemaArchivePanel library={library} />
      </WorkflowStep>
    </div>
  )
}

function SchemaArchivePanel({ library }: Props) {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <strong>Archive & Trash</strong>
          <Badge variant="outline">
            {library.deletedSchemas.length} archived schemas
          </Badge>
        </div>
        {library.deletedSchemas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Archived schemas will appear here with restore controls.
          </p>
        ) : (
          <div className="grid gap-2">
            {library.deletedSchemas.map((schema) => (
              <div
                className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/25 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                key={schema.schema_id}
              >
                <div className="grid min-w-0 gap-1">
                  <strong>{schema.name}</strong>
                  <span className="text-sm text-muted-foreground">
                    {schema.direction} · {schema.format.toUpperCase()} ·
                    archived schema
                  </span>
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
      </CardContent>
    </Card>
  )
}

function InputModeControl({ library }: Props) {
  return (
    <Field label="Input mode">
      <div className="flex flex-wrap gap-2">
        <SegmentedControl
          value={library.draft.inputMethod}
          onValueChange={(value) => {
            if (value === "paste")
              library.usePastedContent(library.draft.content)
          }}
          options={[
            { value: "paste", label: "Paste", icon: <Clipboard size={14} /> },
            {
              value: "upload",
              label: "Upload",
              icon: <Upload size={14} />,
              disabled: true,
            },
          ]}
        />
        <label
          className={[
            "inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition-colors",
            library.draft.inputMethod === "upload"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background text-foreground hover:bg-muted",
          ].join(" ")}
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
    </Field>
  )
}

function UploadDraftPanel({ library }: Props) {
  return (
    <div className="grid gap-3">
      <label className="grid cursor-pointer place-items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center transition-colors hover:bg-muted/50">
        <Upload size={18} />
        <strong>
          {library.draft.originalFilename ?? "Choose a text schema sample"}
        </strong>
        <span className="text-sm text-muted-foreground">
          JSON, XML, EDI 214, and EDI 856 samples are read as text.
        </span>
        <input
          className="hidden"
          type="file"
          onChange={(event) =>
            void library.useUploadedFile(event.currentTarget.files?.[0])
          }
        />
      </label>

      {library.draft.content ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <strong>Uploaded content preview</strong>
            <Badge variant="outline">
              {formatBytes(library.draft.originalSize)}
            </Badge>
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
    <Field label={label}>
      <SegmentedControl
        value={value}
        options={options}
        onValueChange={onChange}
      />
    </Field>
  )
}

function SchemaDraftMeta({ library }: Props) {
  if (
    library.draft.inputMethod === "upload" &&
    library.draft.originalFilename
  ) {
    return (
      <p className="text-xs text-muted-foreground">
        {library.draft.originalFilename} ·{" "}
        {library.draft.originalContentType || "text/plain"} ·{" "}
        {formatBytes(library.draft.originalSize)}
      </p>
    )
  }
  return (
    <p className="text-xs text-muted-foreground">
      Pasted text will be preserved verbatim.
    </p>
  )
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
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <strong>{title}</strong>
        <Badge variant="outline">{schemas.length}</Badge>
      </div>
      <ScrollArea className="max-h-[420px] pr-2">
        <div className="grid gap-2">
          {schemas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved {title.toLowerCase()} schemas.
            </p>
          ) : (
            schemas.map((schema) => (
              <button
                key={schema.schema_id}
                type="button"
                className={[
                  "grid min-w-0 gap-1 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selectedSchemaId === schema.schema_id
                    ? "border-primary bg-secondary/45"
                    : "",
                ].join(" ")}
                onClick={() => onSelect(schema.schema_id)}
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <strong className="truncate">{schema.name}</strong>
                  <Badge
                    variant={
                      selectedSchemaId === schema.schema_id
                        ? "default"
                        : "outline"
                    }
                  >
                    {selectedSchemaId === schema.schema_id
                      ? "Selected"
                      : "Open"}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  {schema.format.toUpperCase()} ·{" "}
                  {formatBytes(schema.original_size)} · click to inspect
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SchemaDetailPanel({ library }: Props) {
  const schema = library.selectedSchema

  if (!schema) {
    return (
      <WorkbenchCard
        kicker="Inspect"
        title="Schema detail"
        className="schema-detail-panel"
      >
        <p className="text-sm text-muted-foreground">
          Select an active schema card from the library to inspect fields,
          samples, and saved rules.
        </p>
      </WorkbenchCard>
    )
  }

  return (
    <WorkbenchCard
      kicker={schema.direction}
      title={schema.name}
      className="schema-detail-panel"
      action={
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
      }
    >
      {schema.description ? (
        <p className="text-sm text-muted-foreground">{schema.description}</p>
      ) : null}
      <StatusAlert
        title="Active library schema"
        description={
          schema.direction === "target"
            ? "Target detail can store field validation rules for mapping runs."
            : "Source detail is read-only and provides sample context for mapping setup."
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{schema.format.toUpperCase()}</Badge>
        <Badge variant="outline">{formatBytes(schema.original_size)}</Badge>
        <Badge variant="outline">{schema.input_method}</Badge>
      </div>
      <SchemaViewer title="Inferred fields" schema={schema.inferred_schema} />
      {schema.direction === "target" ? (
        <TargetValidationRules
          library={library}
          schema={schema.inferred_schema}
        />
      ) : null}
      <div className="schema-preview-grid">
        <PreviewBlock
          title="Canonical sample"
          value={JSON.stringify(schema.canonical_sample, null, 2)}
        />
        <PreviewBlock
          title="Original content"
          value={schema.original_content}
        />
      </div>
    </WorkbenchCard>
  )
}

function TargetValidationRules({
  library,
  schema,
}: Props & { schema: SchemaNode }) {
  const fields = flattenSchema(schema).filter((field) => field.path !== "$")

  if (fields.length === 0) return null

  return (
    <section className="grid gap-3 rounded-lg border bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>Target field validation rules</strong>
        <Badge variant="outline">
          {library.selectedTargetRules.length} saved rules
          {library.dirtyTargetRulePaths.length > 0
            ? ` · ${library.dirtyTargetRulePaths.length} unsaved`
            : ""}
        </Badge>
      </div>
      <div className="grid gap-2">
        {fields.slice(0, 12).map((field) => (
          <FieldRuleRow
            key={field.path}
            field={field}
            savedRule={library.selectedTargetRules.find(
              (rule) => rule.path === field.path
            )}
            draftRule={library.targetRuleDrafts[field.path]}
            dirty={library.dirtyTargetRulePaths.includes(field.path)}
            saving={library.busyAction === "Saving field rule"}
            onUpdate={(patch) =>
              void library.updateFieldRule(field.path, patch)
            }
          />
        ))}
      </div>
      <Button
        type="button"
        className="w-fit"
        onClick={() => void library.saveFieldRules()}
        disabled={
          library.dirtyTargetRulePaths.length === 0 ||
          Boolean(library.busyAction)
        }
      >
        {library.busyAction === "Saving field rule" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Database />
        )}
        Save validation rules
      </Button>
      <p className="text-xs text-muted-foreground">
        Edits stay local until saved. Saved rules are used by mapping runs for
        this target schema.
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
    <div className="grid gap-2 rounded-lg border bg-card p-3 lg:grid-cols-[minmax(160px,1fr)_160px_120px_100px_100px_80px] lg:items-center">
      <span
        className="truncate font-mono text-xs text-muted-foreground"
        title={field.path}
      >
        {field.path}
      </span>
      <SelectField
        label={`${field.path} type`}
        value={valueType}
        onValueChange={(value) =>
          onUpdate({
            ...draftBase(field.path, value, required),
            value_type: value,
          })
        }
        options={validationTypes.map((type) => ({ value: type, label: type }))}
        triggerClassName="h-8"
      />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={required}
          disabled={saving}
          onCheckedChange={(checked) =>
            onUpdate({
              ...draftBase(field.path, valueType, checked === true),
              required: checked === true,
            })
          }
        />
        Required
      </label>
      <Input
        aria-label={`${field.path} min`}
        placeholder="Min"
        value={minValue}
        disabled={saving}
        onChange={(event) =>
          onUpdate({
            ...draftBase(field.path, valueType, required),
            ...minPatch(valueType, event.target.value),
          })
        }
      />
      <Input
        aria-label={`${field.path} max`}
        placeholder="Max"
        value={maxValue}
        disabled={saving}
        onChange={(event) =>
          onUpdate({
            ...draftBase(field.path, valueType, required),
            ...maxPatch(valueType, event.target.value),
          })
        }
      />
      <Badge variant={dirty ? "default" : "outline"}>
        {dirty ? "Unsaved" : savedRule ? "Saved" : "Default"}
      </Badge>
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
    ? {
        min_length: parsed === null ? null : Math.max(0, Math.trunc(parsed)),
        min_value: null,
      }
    : { min_value: parsed, min_length: null }
}

function maxPatch(valueType: string, value: string) {
  const parsed = parseOptionalNumber(value)
  return usesLength(valueType)
    ? {
        max_length: parsed === null ? null : Math.max(0, Math.trunc(parsed)),
        max_value: null,
      }
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

const validationTypes = [
  "string",
  "date",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "mixed",
]

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-3">
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
