// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MappingSchemaPanel } from "./MappingSchemaPanel"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

afterEach(cleanup)

describe("MappingSchemaPanel", () => {
  it("keeps author and run actions out of schema selection", () => {
    render(
      <MappingSchemaPanel
        workbench={baseWorkbench as unknown as ReturnType<typeof useMappingWorkbenchController>}
        sourceSchemas={[]}
        targetSchemas={[]}
        onOpenSchemaTab={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "New Mapping" })).toBeInstanceOf(HTMLButtonElement)
    expect(screen.getByText("No template loaded")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "AI-assisted" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Field hints" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Run script" })).toBeNull()
  })

  it("keeps selectors active-only while showing detached snapshot context", () => {
    render(
      <MappingSchemaPanel
        workbench={detachedWorkbench as unknown as ReturnType<typeof useMappingWorkbenchController>}
        sourceSchemas={[activeSourceSchema]}
        targetSchemas={[activeTargetSchema]}
        onOpenSchemaTab={vi.fn()}
      />
    )

    expect(screen.getByText("Loaded template v2")).toBeTruthy()
    expect(screen.getByText(/Source: detached snapshot fallback/)).toBeTruthy()
    expect(screen.getByText(/Target: detached snapshot fallback/)).toBeTruthy()
    expect(screen.getByText(/Rules: 1/)).toBeTruthy()
    expect(screen.queryByRole("option", { name: /Archived Source/ })).toBeNull()
    expect(screen.queryByRole("option", { name: /Archived Target/ })).toBeNull()
    expect(screen.getByRole("option", { name: /Active Source/ })).toBeTruthy()
    expect(screen.getByRole("option", { name: /Active Target/ })).toBeTruthy()
  })
})

const baseWorkbench = {
  selectedSourceSchemaId: "",
  selectedTargetSchemaId: "",
  selectedSourceSchema: null,
  selectedTargetSchema: null,
  activeSourceSchema: null,
  activeTargetSchema: null,
  fieldValidationRules: [],
  activeTemplate: null,
  runMode: "saved-sample",
  overrideSourceInput: "",
  autoMapMode: "local",
  aiMappingAvailable: false,
  busyAction: null,
  readyForMapping: false,
  readyForTransform: false,
  statusText: "Waiting for schemas",
  selectSourceSchema: vi.fn(),
  selectTargetSchema: vi.fn(),
  startNewMapping: vi.fn(),
  setAutoMapMode: vi.fn(),
  autoMap: vi.fn(),
  runTransform: vi.fn(),
  setRunMode: vi.fn(),
  setOverrideSourceInput: vi.fn(),
}

const schemaNode = { path: "$", type: "object" as const, required: true, examples: [] }
const activeSourceSchema = {
  schema_id: "active-source",
  name: "Active Source",
  description: "",
  direction: "source" as const,
  format: "json" as const,
  original_content: "{}",
  original_size: 2,
  input_method: "paste" as const,
  canonical_sample: {},
  inferred_schema: schemaNode,
  parse_metadata: {},
  created_at: "2026-06-19T00:00:00Z",
}
const activeTargetSchema = { ...activeSourceSchema, schema_id: "active-target", name: "Active Target", direction: "target" as const }
const detachedWorkbench = {
  ...baseWorkbench,
  selectedSourceSchemaId: "archived-source",
  selectedTargetSchemaId: "archived-target",
  activeSourceSchema: schemaNode,
  activeTargetSchema: schemaNode,
  readyForMapping: true,
  fieldValidationRules: [{ path: "$.id", value_type: "string", required: true }],
  activeTemplate: {
    template_id: "loaded",
    name: "Loaded template",
    description: "",
    active_version: 2,
    is_seeded: false,
    versions: [],
  },
}
