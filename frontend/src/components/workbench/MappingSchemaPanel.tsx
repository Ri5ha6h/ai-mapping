import { Database, FilePlus2, PlaySquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
        <Database size={18} className="text-muted-foreground" />
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

      <div className="mapping-stage-toolbar" aria-label="Mapping stage toolbar">
        <Button
          type="button"
          variant="outline"
          onClick={() => void workbench.startNewMapping()}
          disabled={Boolean(workbench.busyAction)}
        >
          <FilePlus2 />
          New Transform
        </Button>
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

      <div className="run-mode-panel">
        <div className="field-stack">
          <span>Run input</span>
          <div className="schema-segmented-control">
            <button
              type="button"
              className={workbench.runMode === "saved-sample" ? "active" : ""}
              onClick={() => workbench.setRunMode("saved-sample")}
            >
              Saved sample
            </button>
            <button
              type="button"
              className={workbench.runMode === "override" ? "active" : ""}
              onClick={() => workbench.setRunMode("override")}
              disabled={!workbench.selectedSourceSchema}
            >
              Override
            </button>
          </div>
        </div>
        {workbench.runMode === "override" ? (
          <Textarea
            className="code-input min-h-48"
            value={workbench.overrideSourceInput}
            onChange={(event) =>
              workbench.setOverrideSourceInput(event.target.value)
            }
            spellCheck={false}
          />
        ) : (
          <div className="run-sample-summary">
            <PlaySquare size={16} />
            <span>
              {workbench.selectedSourceSchema
                ? `${workbench.selectedSourceSchema.name} saved sample`
                : "Loaded template sample"}
            </span>
          </div>
        )}
      </div>
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
