// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { CurrentMappingInputs } from "./useMappingSetupController"
import { useRunReviewController } from "./useRunReviewController"

const transformEffect = vi.fn()
const validateEffect = vi.fn()
const diffOutputEffect = vi.fn()

vi.mock("@/lib/effect/api_effects", async () => {
  return {
    transformEffect: (...args: unknown[]) => transformEffect(...args),
    validateEffect: (...args: unknown[]) => validateEffect(...args),
    diffOutputEffect: (...args: unknown[]) => diffOutputEffect(...args),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useRunReviewController", () => {
  it("runs JSON transforms, validates output, and requests a diff", async () => {
    const { Effect } = await import("effect")
    transformEffect.mockReturnValue(
      Effect.succeed(transformResponse({ id: 2 }))
    )
    validateEffect.mockReturnValue(
      Effect.succeed({ errors: [{ path: "$.id", message: "Mismatch" }] })
    )
    diffOutputEffect.mockReturnValue(
      Effect.succeed({
        equal: false,
        supported: true,
        diffs: [{ path: "$.id", kind: "changed" }],
      })
    )

    render(<RunReviewProbe />)
    await act(async () => screen.getByRole("button", { name: "run" }).click())

    expect(transformEffect).toHaveBeenCalledWith(
      baseInputs.sourceData,
      mappingSpec,
      "json",
      baseInputs.targetSchema,
      baseInputs.fieldValidationRules
    )
    expect(validateEffect).toHaveBeenCalled()
    expect(diffOutputEffect).toHaveBeenCalledWith(
      baseInputs.targetData,
      { id: 2 },
      "json"
    )
    expect(screen.getByTestId("output").textContent).toContain("2")
    expect(screen.getByTestId("errors").textContent).toBe("1")
    expect(screen.getByTestId("diffs").textContent).toBe("1")
    expect(screen.getByTestId("logs").textContent).toBe("ran")
  })

  it("skips diff calls for XML output and clears stale run state", async () => {
    const { Effect } = await import("effect")
    transformEffect.mockReturnValue(
      Effect.succeed(transformResponse("<ShipmentEvent />"))
    )
    validateEffect.mockReturnValue(Effect.succeed({ errors: [] }))

    render(<RunReviewProbe outputFormat="xml" />)
    await act(async () => screen.getByRole("button", { name: "run" }).click())
    act(() => screen.getByRole("button", { name: "clear" }).click())

    expect(transformEffect).toHaveBeenCalledWith(
      baseInputs.sourceData,
      mappingSpec,
      "xml",
      null,
      baseInputs.fieldValidationRules
    )
    expect(diffOutputEffect).not.toHaveBeenCalled()
    expect(screen.getByTestId("output").textContent).toBe("none")
    expect(screen.getByTestId("status").textContent).toBe("Ready to run script")
  })
})

function RunReviewProbe({
  outputFormat = "json",
}: {
  outputFormat?: "json" | "xml"
}) {
  const controller = useRunReviewController({
    currentMappingInputs: () => Promise.resolve(baseInputs),
    mappingSpec,
    outputFormat,
    readyForMapping: true,
    withBusy: (_label, action) => action(),
  })

  return (
    <div>
      <span data-testid="output">
        {controller.transformResult
          ? JSON.stringify(controller.transformResult.output)
          : "none"}
      </span>
      <span data-testid="errors">{controller.validationErrors.length}</span>
      <span data-testid="diffs">{controller.outputDiff.length}</span>
      <span data-testid="logs">
        {controller.runLogs.map((log) => log.message).join(",")}
      </span>
      <span data-testid="status">{controller.reviewStatusText}</span>
      <button onClick={() => controller.runTransform()}>run</button>
      <button onClick={() => controller.clearRunResults()}>clear</button>
    </div>
  )
}

const mappingSpec = {
  engine: "script_js" as const,
  script_version: 1,
  script: "function transform() { return {}; }",
}

const baseInputs: CurrentMappingInputs = {
  sourceData: { id: 1 },
  targetData: { id: 1 },
  sourceSchema: { path: "$", type: "object", required: true, examples: [] },
  targetSchema: { path: "$", type: "object", required: true, examples: [] },
  fieldValidationRules: [
    {
      schema_id: "target-orders",
      path: "$.id",
      value_type: "integer",
      required: true,
      created_at: "2026-06-19T00:00:00Z",
      updated_at: "2026-06-19T00:00:00Z",
    },
  ],
}

function transformResponse(output: unknown) {
  return {
    output_format: typeof output === "string" ? "xml" : "json",
    output,
    validation_errors: [],
    logs: [{ level: "log", message: "ran", index: 0 }],
    trace: [],
  }
}
