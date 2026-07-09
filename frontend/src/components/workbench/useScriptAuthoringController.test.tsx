// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { CurrentMappingInputs } from "./useMappingSetupController"
import { useScriptAuthoringController } from "./useScriptAuthoringController"

const suggestMappingsEffect = vi.fn()
const generateScriptDraftEffect = vi.fn()

vi.mock("@/lib/effect/api_effects", async () => {
  const { Effect } = await import("effect")
  return {
    getMappingCapabilitiesEffect: () =>
      Effect.succeed({ ai_mapping_available: true }),
    suggestMappingsEffect: (...args: unknown[]) =>
      suggestMappingsEffect(...args),
    generateScriptDraftEffect: (...args: unknown[]) =>
      generateScriptDraftEffect(...args),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useScriptAuthoringController", () => {
  it("generates field hints and tracks AI/local provider status", async () => {
    const { Effect } = await import("effect")
    suggestMappingsEffect.mockReturnValue(
      Effect.succeed({
        suggestions: [
          {
            source_path: "$.id",
            target_path: "$.id",
            confidence: 0.98,
            rationale: "match",
          },
        ],
        used_ai: false,
        provider_errors: ["provider unavailable"],
      })
    )

    render(<AuthoringProbe />)
    await waitFor(() =>
      expect(screen.getByTestId("ai-available").textContent).toBe("yes")
    )
    act(() => screen.getByRole("button", { name: "ai mode" }).click())
    await act(async () => screen.getByRole("button", { name: "hints" }).click())

    expect(suggestMappingsEffect).toHaveBeenCalledWith(
      baseInputs.sourceSchema,
      baseInputs.targetSchema,
      true
    )
    expect(screen.getByTestId("status").textContent).toBe(
      "AI failed, local used"
    )
    expect(screen.getByTestId("providers").textContent).toBe(
      "provider unavailable"
    )
    expect(screen.getByTestId("suggestions").textContent).toBe("1")
  })

  it("generates scripts and clears stale run results when script changes", async () => {
    const { Effect } = await import("effect")
    const clearRunResults = vi.fn()
    generateScriptDraftEffect.mockReturnValue(
      Effect.succeed({
        mapping_spec: {
          engine: "script_js",
          script_version: 1,
          script: "function transform() { return { id: 1 }; }",
        },
        explanation: "Generated from local hints.",
        unresolved_target_paths: ["$.missing"],
        provider_errors: [],
        used_ai: false,
      })
    )

    render(<AuthoringProbe clearRunResults={clearRunResults} />)
    await act(async () =>
      screen.getByRole("button", { name: "generate" }).click()
    )
    act(() => screen.getByRole("button", { name: "edit" }).click())

    expect(generateScriptDraftEffect).toHaveBeenCalled()
    expect(screen.getByTestId("script").textContent).toContain("return source")
    expect(screen.getByTestId("explanation").textContent).toBe(
      "Generated from local hints."
    )
    expect(screen.getByTestId("unresolved").textContent).toBe("$.missing")
    expect(clearRunResults).toHaveBeenCalledTimes(2)
  })
})

function AuthoringProbe({
  clearRunResults = vi.fn(),
}: {
  clearRunResults?: () => void
}) {
  const controller = useScriptAuthoringController({
    currentMappingInputs: () => Promise.resolve(baseInputs),
    clearRunResults,
  })

  return (
    <div>
      <span data-testid="ai-available">
        {controller.aiMappingAvailable ? "yes" : "no"}
      </span>
      <span data-testid="status">{controller.autoMapStatusText}</span>
      <span data-testid="providers">{controller.providerErrors.join(",")}</span>
      <span data-testid="suggestions">{controller.suggestions.length}</span>
      <span data-testid="script">{controller.script}</span>
      <span data-testid="explanation">{controller.draftExplanation}</span>
      <span data-testid="unresolved">
        {controller.unresolvedTargetPaths.join(",")}
      </span>
      <button onClick={() => controller.setAutoMapMode("ai")}>ai mode</button>
      <button onClick={() => controller.autoMap()}>hints</button>
      <button onClick={() => controller.generateScript()}>generate</button>
      <button
        onClick={() =>
          controller.setScript("function transform(source) { return source; }")
        }
      >
        edit
      </button>
    </div>
  )
}

const baseInputs: CurrentMappingInputs = {
  sourceData: { id: 1 },
  targetData: { id: 1 },
  sourceSchema: { path: "$", type: "object", required: true, examples: [] },
  targetSchema: { path: "$", type: "object", required: true, examples: [] },
  fieldValidationRules: [],
}
