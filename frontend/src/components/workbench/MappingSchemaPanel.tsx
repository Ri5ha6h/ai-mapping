import { Database } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SchemaArtifact } from "@/types/schema"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"
import { SelectField, StatusAlert, WorkbenchCard } from "./ui"

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
    <WorkbenchCard
      kicker="Mapping context"
      title="Schema and template setup"
      className="mapping-schema-panel"
    >
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
        <StatusAlert
          title="Schema pair required"
          description="Create or select one source schema and one target schema."
          className="items-center"
        />
      ) : null}
      {!workbench.readyForMapping ? (
        <Button type="button" variant="outline" onClick={onOpenSchemaTab} className="w-fit">
          Open Schema tab
        </Button>
      ) : null}
    </WorkbenchCard>
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
    <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-secondary/35 px-3 py-2 text-sm" aria-live="polite">
      <Database size={16} />
      <div className="grid min-w-0 gap-1">
        <strong className="truncate">
          {workbench.activeTemplate
            ? `${workbench.activeTemplate.name} v${workbench.activeTemplate.active_version}`
            : "No template loaded"}
        </strong>
        <span className="text-muted-foreground">
          {workbench.activeTemplate
            ? "Loaded versions carry script, samples, schema snapshots, and field validation rules."
            : "Select active schemas or load a saved template to begin."}
        </span>
        <span className="text-xs text-muted-foreground">
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
    <SelectField
      label={label}
      value={value}
      placeholder="No schema selected"
      onValueChange={onChange}
      options={[
        { value: "", label: "No schema selected" },
        ...schemas.map((schema) => ({
          value: schema.schema_id,
          label: `${schema.name} (${schema.format.toUpperCase()})`,
        })),
      ]}
    />
  )
}
