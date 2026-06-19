// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SchemaLibraryPanel } from "./SchemaLibraryPanel"

afterEach(cleanup)

const schema = {
  schema_id: "schema-1",
  name: "Shipment source",
  description: "Source sample",
  direction: "source" as const,
  format: "json" as const,
  input_method: "paste" as const,
  original_content: '{"id":"1"}',
  original_filename: null,
  original_size: 10,
  canonical_sample: { id: "1" },
  inferred_schema: {
    name: "root",
    path: "$",
    type: "object" as const,
    required: true,
    children: [],
  },
  parse_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
}

const targetSchema = {
  ...schema,
  schema_id: "target-1",
  name: "Shipment target",
  direction: "target" as const,
  inferred_schema: {
    path: "$",
    type: "object" as const,
    required: true,
    fields: {
      shipment: {
        path: "$.shipment",
        type: "object" as const,
        required: true,
        fields: {
          weight: {
            path: "$.shipment.weight",
            type: "number" as const,
            required: true,
            examples: [5],
          },
        },
        examples: [],
      },
    },
    examples: [],
  },
}

function makeLibrary() {
  return {
    sourceSchemas: [schema],
    targetSchemas: [],
    deletedSchemas: [],
    selectedLibraryDirection: "source" as const,
    selectedSchemaId: "schema-1",
    selectedSchema: schema,
    busyAction: null,
    issue: null,
    draft: {
      name: "",
      description: "",
      direction: "source" as const,
      format: "json" as const,
      inputMethod: "paste" as const,
      content: "",
      originalFilename: null,
      originalContentType: null,
      originalSize: null,
    },
    canCreateSchema: false,
    refreshSchemas: vi.fn(),
    setSelectedSchemaId: vi.fn(),
    updateDraft: vi.fn(),
    usePastedContent: vi.fn(),
    useUploadedFile: vi.fn(),
    createSchema: vi.fn(),
    deleteSelectedSchema: vi.fn(),
    restoreSchema: vi.fn(),
    selectedTargetRules: [],
    targetRuleDrafts: {},
    dirtyTargetRulePaths: [],
    setSelectedLibraryDirection: vi.fn(),
    updateFieldRule: vi.fn(),
    saveFieldRules: vi.fn(),
  }
}

describe("SchemaLibraryPanel", () => {
  it("orders schema work as create, library, and visible selected details", () => {
    render(<SchemaLibraryPanel library={makeLibrary() as never} />)

    expect(screen.getByRole("heading", { name: "Create" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Library & Detail" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Schema artifact" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Saved schemas" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Shipment source" })).toBeTruthy()
  })

  it("shows controlled target field rules and saves edits", () => {
    const library = {
      ...makeLibrary(),
      sourceSchemas: [],
      targetSchemas: [targetSchema],
      selectedSchemaId: "target-1",
      selectedSchema: targetSchema,
      selectedLibraryDirection: "target" as const,
      selectedTargetRules: [
        {
          schema_id: "target-1",
          path: "$.shipment.weight",
          value_type: "number",
          required: true,
          min_value: 1,
          max_value: 10,
          min_length: null,
          max_length: null,
          description: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    }
    render(<SchemaLibraryPanel library={library as never} />)

    expect(screen.getByText("Target field validation rules")).toBeTruthy()
    expect(screen.getByText("Saved")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Save validation rules/i }).hasAttribute("disabled")).toBe(true)

    fireEvent.change(screen.getByLabelText("$.shipment.weight type"), {
      target: { value: "integer" },
    })
    fireEvent.click(screen.getByLabelText("Required"))
    fireEvent.change(screen.getByLabelText("$.shipment.weight min"), {
      target: { value: "2" },
    })
    fireEvent.change(screen.getByLabelText("$.shipment.weight max"), {
      target: { value: "" },
    })

    expect(library.updateFieldRule).toHaveBeenCalledWith("$.shipment.weight", expect.objectContaining({
      value_type: "integer",
    }))
    expect(library.updateFieldRule).toHaveBeenCalledWith("$.shipment.weight", expect.objectContaining({
      required: false,
    }))
    expect(library.updateFieldRule).toHaveBeenCalledWith("$.shipment.weight", expect.objectContaining({
      min_value: 2,
      min_length: null,
    }))
    expect(library.updateFieldRule).toHaveBeenCalledWith("$.shipment.weight", expect.objectContaining({
      max_value: null,
      max_length: null,
    }))
  })

  it("keeps cleared min and max fields empty before save", () => {
    const library = {
      ...makeLibrary(),
      sourceSchemas: [],
      targetSchemas: [targetSchema],
      selectedSchemaId: "target-1",
      selectedSchema: targetSchema,
      selectedLibraryDirection: "target" as const,
      selectedTargetRules: [
        {
          schema_id: "target-1",
          path: "$.shipment.weight",
          value_type: "number",
          required: true,
          min_value: 1,
          max_value: 10,
          min_length: null,
          max_length: null,
          description: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      targetRuleDrafts: {
        "$.shipment.weight": {
          path: "$.shipment.weight",
          value_type: "number",
          required: true,
          min_value: null,
          max_value: null,
          min_length: null,
          max_length: null,
          description: null,
        },
      },
      dirtyTargetRulePaths: ["$.shipment.weight"],
    }

    render(<SchemaLibraryPanel library={library as never} />)

    expect((screen.getByLabelText("$.shipment.weight min") as HTMLInputElement).value).toBe("")
    expect((screen.getByLabelText("$.shipment.weight max") as HTMLInputElement).value).toBe("")
    expect(screen.getByText("Unsaved")).toBeTruthy()
  })

  it("uses a schema type selector before loading saved schemas", () => {
    const library = makeLibrary()
    render(<SchemaLibraryPanel library={library as never} />)

    fireEvent.click(screen.getAllByRole("button", { name: "Target" })[1])

    expect(library.setSelectedLibraryDirection).toHaveBeenCalledWith("target")
  })

  it("hides field rules for source schemas and keeps cards selectable", () => {
    const library = makeLibrary()
    render(<SchemaLibraryPanel library={library as never} />)

    expect(screen.queryByText("Target field validation rules")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Shipment source/i }))
    expect(library.setSelectedSchemaId).toHaveBeenCalledWith("schema-1")
  })
})
