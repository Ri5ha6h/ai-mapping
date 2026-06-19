import { Database, FilePlus2 } from "lucide-react"

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
          <p className="panel-kicker">Script transform</p>
          <h2>Schema selection</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void workbench.startNewMapping()}
          disabled={Boolean(workbench.busyAction)}
        >
          <FilePlus2 />
          New Mapping
        </Button>
      </div>

      <div className="active-template-strip" aria-live="polite">
        <Database size={16} />
        <div>
          <strong>{workbench.activeTemplate ? workbench.activeTemplate.name : "No template loaded"}</strong>
          <span>
            {workbench.activeTemplate
              ? `Using version ${workbench.activeTemplate.active_version}; schema snapshots stay available even if library items are archived.`
              : "Select schemas or load a saved template to begin."}
          </span>
        </div>
      </div>

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
