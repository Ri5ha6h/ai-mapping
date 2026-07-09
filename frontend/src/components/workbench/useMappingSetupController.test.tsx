// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { SchemaArtifact, SchemaNode } from "@/types/schema"
import { useMappingSetupController } from "./useMappingSetupController"

vi.mock("@/lib/effect/api_effects", async () => {
  const { Effect } = await import("effect")
  return {
    parseEffect: (_format: string, content: string) =>
      Effect.succeed({ canonical: JSON.parse(content) }),
    inferSchemaEffect: (canonical: unknown) =>
      Effect.succeed({
        schema: schemaNode(
          "$",
          typeof canonical === "object" ? "object" : "string"
        ),
      }),
    listFieldValidationRulesEffect: () => Effect.succeed({ rules: [] }),
  }
})

afterEach(cleanup)

describe("useMappingSetupController", () => {
  it("selects saved schemas and derives active setup state", () => {
    const onSetupChanged = vi.fn()
    render(<SetupProbe onSetupChanged={onSetupChanged} />)

    act(() => screen.getByRole("button", { name: "select source" }).click())
    act(() => screen.getByRole("button", { name: "select target" }).click())

    expect(screen.getByTestId("ready").textContent).toBe("ready")
    expect(screen.getByTestId("source-format").textContent).toBe("xml")
    expect(screen.getByTestId("target-format").textContent).toBe("json")
    expect(onSetupChanged).toHaveBeenCalledTimes(2)
  })

  it("supports ad-hoc parsing, override input resolution, and reset", async () => {
    let resolved: unknown = null
    render(<SetupProbe onResolved={(value) => (resolved = value)} />)

    await act(async () =>
      screen.getByRole("button", { name: "infer ad hoc" }).click()
    )
    await waitFor(() =>
      expect(screen.getByTestId("ready").textContent).toBe("ready")
    )

    act(() => screen.getByRole("button", { name: "select source" }).click())
    act(() => screen.getByRole("button", { name: "override mode" }).click())
    await act(async () =>
      screen.getByRole("button", { name: "resolve inputs" }).click()
    )
    expect(resolved).toEqual({ shipment: { id: "override" } })

    act(() => screen.getByRole("button", { name: "reset" }).click())
    expect(screen.getByTestId("ready").textContent).toBe("waiting")
  })

  it("uses override input with restored schema snapshots when live source is unavailable", async () => {
    let resolved: unknown = null
    render(
      <SetupProbe
        sourceSchemas={[]}
        onResolved={(value) => (resolved = value)}
      />
    )

    act(() =>
      screen.getByRole("button", { name: "restore source snapshot" }).click()
    )
    act(() => screen.getByRole("button", { name: "select target" }).click())
    act(() => screen.getByRole("button", { name: "override mode" }).click())
    await act(async () =>
      screen.getByRole("button", { name: "resolve inputs" }).click()
    )

    expect(resolved).toEqual({ shipment: { id: "override" } })
  })
})

function SetupProbe({
  onSetupChanged = vi.fn(),
  onResolved = vi.fn(),
  sourceSchemas = [sourceArtifact],
}: {
  onSetupChanged?: () => void
  onResolved?: (value: unknown) => void
  sourceSchemas?: SchemaArtifact[]
}) {
  const controller = useMappingSetupController({
    sourceSchemas,
    targetSchemas: [targetArtifact],
    onSetupChanged,
  })

  return (
    <div>
      <span data-testid="ready">
        {controller.readyForMapping ? "ready" : "waiting"}
      </span>
      <span data-testid="source-format">{controller.activeSourceFormat}</span>
      <span data-testid="target-format">{controller.activeTargetFormat}</span>
      <button onClick={() => controller.selectSourceSchema("source-1")}>
        select source
      </button>
      <button onClick={() => controller.selectTargetSchema("target-1")}>
        select target
      </button>
      <button
        onClick={() => {
          controller.setSourceFormat("json")
          controller.setSourceInput('{"shipment":{"id":"saved snapshot"}}')
          controller.setOverrideSourceInput(
            '{"shipment":{"id":"saved snapshot"}}'
          )
          controller.setSourceSchema(sourceSchema)
          controller.setSelectedSourceSchemaId("archived-source")
        }}
      >
        restore source snapshot
      </button>
      <button onClick={() => controller.parseAndInfer()}>infer ad hoc</button>
      <button
        onClick={() => {
          controller.setRunMode("override")
          controller.setOverrideSourceInput('{"shipment":{"id":"override"}}')
        }}
      >
        override mode
      </button>
      <button
        onClick={async () => {
          const inputs = await controller.currentMappingInputs()
          onResolved(inputs.sourceData)
        }}
      >
        resolve inputs
      </button>
      <button onClick={() => controller.resetSetup()}>reset</button>
    </div>
  )
}

const sourceSchema = schemaNode("$", "object")
const targetSchema = schemaNode("$", "object")

const sourceArtifact: SchemaArtifact = {
  schema_id: "source-1",
  name: "Source XML",
  description: "",
  direction: "source",
  format: "xml",
  input_method: "paste",
  original_content: '{"shipment":{"id":"saved"}}',
  original_size: 27,
  canonical_sample: { shipment: { id: "saved" } },
  inferred_schema: sourceSchema,
  parse_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
}

const targetArtifact: SchemaArtifact = {
  schema_id: "target-1",
  name: "Target JSON",
  description: "",
  direction: "target",
  format: "json",
  input_method: "paste",
  original_content: '{"id":"saved"}',
  original_size: 14,
  canonical_sample: { id: "saved" },
  inferred_schema: targetSchema,
  parse_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
}

function schemaNode(path: string, type: SchemaNode["type"]): SchemaNode {
  return { path, type, required: true, examples: [] }
}
