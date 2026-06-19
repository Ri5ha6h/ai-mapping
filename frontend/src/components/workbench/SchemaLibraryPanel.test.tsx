// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
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

function makeLibrary() {
  return {
    sourceSchemas: [schema],
    targetSchemas: [],
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
  }
}

describe("SchemaLibraryPanel", () => {
  it("keeps create and library primary while selected schema details are disclosed", () => {
    render(<SchemaLibraryPanel library={makeLibrary() as never} />)

    expect(screen.getByRole("heading", { name: "Schema artifact" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Saved schemas" })).toBeTruthy()
    expect(screen.getByText("Selected schema details")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Shipment source" })).toBeTruthy()
  })
})
