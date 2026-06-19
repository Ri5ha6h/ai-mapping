import { Database } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SchemaArtifact } from "@/types/schema"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

type Props = {
  workbench: ReturnType<typeof useMappingWorkbenchController>
  sourceSchemas: SchemaArtifact[]
  targetSchemas: SchemaArtifact[]
  onOpenSchemaTab: () => void
}

export function MappingSchemaPanel({
  workbench,
  sourceSchemas,
  targetSchemas,
  onOpenSchemaTab,
}: Props) {
  return (
    <section className="tool-panel mapping-schema-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Mapping context</p>
          <h2>Schema and template setup</h2>
        </div>
      </div>

      <MappingContextStrip workbench={workbench} />

      <div className="mapping-schema-grid">
        <SchemaSelect
          label="Source schema"
          value={workbench.selectedSourceSchemaId}
          schemas={sourceSchemas}
          onChange={workbench.selectSourceSchema}
        />
        <SchemaSelect
          label="Target schema"
          value={workbench.selectedTargetSchemaId}
          schemas={targetSchemas}
          onChange={workbench.selectTargetSchema}
        />
      </div>

      {!workbench.readyForMapping ? (
        <div className="template-note">
          <strong>Schema pair required</strong>
          <span>Create or select one source schema and one target schema.</span>
          <Button type="button" variant="outline" onClick={onOpenSchemaTab}>
            Open Schema tab
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function MappingContextStrip({ workbench }: { workbench: ReturnType<typeof useMappingWorkbenchController> }) {
  const sourceStatus = schemaContextStatus(
    workbench.selectedSourceSchemaId,
    Boolean(workbench.selectedSourceSchema),
    Boolean(workbench.activeSourceSchema)
  )
  const targetStatus = schemaContextStatus(
    workbench.selectedTargetSchemaId,
    Boolean(workbench.selectedTargetSchema),
    Boolean(workbench.activeTargetSchema)
  )

  return (
    <div className="active-template-strip mapping-context-strip" aria-live="polite">
      <Database size={16} />
      <div>
        <strong>
          {workbench.activeTemplate
            ? `${workbench.activeTemplate.name} v${workbench.activeTemplate.active_version}`
            : "No template loaded"}
        </strong>
        <span>
          {workbench.activeTemplate
            ? "Loaded versions carry script, samples, schema snapshots, and field validation rules."
            : "Select active schemas or load a saved template to begin."}
        </span>
        <span className="mapping-context-status">
          Source: {sourceStatus} · Target: {targetStatus} · Rules: {workbench.fieldValidationRules.length}
        </span>
      </div>
    </div>
  )
}

function schemaContextStatus(schemaId: string, hasLiveSchema: boolean, hasSnapshot: boolean) {
  if (hasLiveSchema) return "active library schema"
  if (schemaId && hasSnapshot) return "detached snapshot fallback"
  if (hasSnapshot) return "stored snapshot"
  return "not selected"
}

function SchemaSelect({
  label,
  value,
  schemas,
  onChange,
}: {
  label: string
  value: string
  schemas: SchemaArtifact[]
  onChange: (schemaId: string) => void
}) {
  return (
    <label className="field-stack">
      <span>{label}</span>
      <select
        className="template-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">No schema selected</option>
        {schemas.map((schema) => (
          <option key={schema.schema_id} value={schema.schema_id}>
            {schema.name} ({schema.format.toUpperCase()})
          </option>
        ))}
      </select>
    </label>
  )
}
