// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useTemplateLifecycleController } from "./useTemplateLifecycleController"

const listTemplatesEffect = vi.fn()
const createTemplateEffect = vi.fn()
const createTemplateVersionEffect = vi.fn()
const getTemplateEffect = vi.fn()
const deleteTemplateEffect = vi.fn()
const restoreTemplateEffect = vi.fn()

vi.mock("@/lib/effect/api_effects", async () => {
  return {
    listTemplatesEffect: (...args: unknown[]) => listTemplatesEffect(...args),
    createTemplateEffect: (...args: unknown[]) => createTemplateEffect(...args),
    createTemplateVersionEffect: (...args: unknown[]) =>
      createTemplateVersionEffect(...args),
    getTemplateEffect: (...args: unknown[]) => getTemplateEffect(...args),
    deleteTemplateEffect: (...args: unknown[]) => deleteTemplateEffect(...args),
    restoreTemplateEffect: (...args: unknown[]) =>
      restoreTemplateEffect(...args),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useTemplateLifecycleController", () => {
  it("loads template lists and saves new templates and versions", async () => {
    const { Effect } = await import("effect")
    listTemplatesEffect.mockReturnValue(
      Effect.succeed({ templates: [savedTemplate] })
    )
    createTemplateEffect.mockReturnValue(Effect.succeed(savedTemplate))
    createTemplateVersionEffect.mockReturnValue(
      Effect.succeed(versionedTemplate)
    )

    render(<TemplateLifecycleProbe />)
    await waitFor(() =>
      expect(screen.getByTestId("templates").textContent).toBe("1")
    )
    await act(async () => screen.getByRole("button", { name: "save" }).click())
    await act(async () =>
      screen.getByRole("button", { name: "version" }).click()
    )

    expect(createTemplateEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Shipment transform",
        field_validation_rules: [
          expect.objectContaining({ path: "$.id", value_type: "string" }),
        ],
      })
    )
    expect(createTemplateVersionEffect).toHaveBeenCalledWith(
      "saved",
      expect.objectContaining({ mapping_spec: mappingSpec })
    )
    expect(screen.getByTestId("selected").textContent).toBe("saved")
  })

  it("restores schema ids, snapshots, samples, script, validation, and prompt state", async () => {
    const { Effect } = await import("effect")
    const setSourceSchema = vi.fn()
    const setTargetSchema = vi.fn()
    const setScriptRaw = vi.fn()
    const setFieldValidationRules = vi.fn()
    const setOverrideSourceInput = vi.fn()
    const restoreValidationErrors = vi.fn()
    listTemplatesEffect.mockReturnValue(
      Effect.succeed({ templates: [savedTemplate] })
    )
    getTemplateEffect.mockReturnValue(Effect.succeed(savedTemplate))

    render(
      <TemplateLifecycleProbe
        setSourceSchema={setSourceSchema}
        setTargetSchema={setTargetSchema}
        setScriptRaw={setScriptRaw}
        setFieldValidationRules={setFieldValidationRules}
        setOverrideSourceInput={setOverrideSourceInput}
        restoreValidationErrors={restoreValidationErrors}
      />
    )
    await act(async () => screen.getByRole("button", { name: "load" }).click())
    await act(async () => screen.getByRole("button", { name: "new" }).click())
    act(() => screen.getByRole("button", { name: "cancel" }).click())

    expect(getTemplateEffect).toHaveBeenCalledWith("saved")
    expect(setSourceSchema).toHaveBeenCalledWith(schema)
    expect(setTargetSchema).toHaveBeenCalledWith(schema)
    expect(setScriptRaw).toHaveBeenCalledWith(mappingSpec.script)
    expect(setOverrideSourceInput).toHaveBeenCalledWith('{"id":1}')
    expect(setFieldValidationRules).toHaveBeenCalledWith([
      expect.objectContaining({
        path: "$.id",
        value_type: "string",
        required: true,
      }),
    ])
    expect(restoreValidationErrors).toHaveBeenCalledWith([
      { path: "$.id", message: "Required" },
    ])
    expect(screen.getByTestId("prompt").textContent).toBe("closed")
  })
})

function TemplateLifecycleProbe(
  overrides: Partial<Parameters<typeof useTemplateLifecycleController>[0]> = {}
) {
  const controller = useTemplateLifecycleController({
    activeSourceFormat: "json",
    activeTargetFormat: "json",
    activeSourceSchema: schema,
    activeTargetSchema: schema,
    selectedSourceSchema: null,
    selectedTargetSchema: null,
    sourceInput: "{}",
    targetInput: "{}",
    mappingSpec,
    validationErrors: [],
    fieldValidationRules: [fieldRule],
    readyForTemplateSave: true,
    hasRunResult: false,
    setIssue: vi.fn(),
    setBusyAction: vi.fn(),
    setSourceFormat: vi.fn(),
    setTargetFormat: vi.fn(),
    setSelectedSourceSchemaId: vi.fn(),
    setSelectedTargetSchemaId: vi.fn(),
    setSourceInput: vi.fn(),
    setTargetInput: vi.fn(),
    setOverrideSourceInput: vi.fn(),
    setSourceSchema: vi.fn(),
    setTargetSchema: vi.fn(),
    setFieldValidationRules: vi.fn(),
    setScriptRaw: vi.fn(),
    restoreValidationErrors: vi.fn(),
    clearRunResults: vi.fn(),
    resetSetup: vi.fn(),
    resetAuthoring: vi.fn(),
    clearAuthoringContext: vi.fn(),
    ...overrides,
  })

  return (
    <div>
      <span data-testid="templates">{controller.templates.length}</span>
      <span data-testid="selected">{controller.selectedTemplateId}</span>
      <span data-testid="prompt">
        {controller.newMappingPrompt.open ? "open" : "closed"}
      </span>
      <button onClick={() => controller.saveTemplate()}>save</button>
      <button onClick={() => controller.selectTemplate("saved")}>select</button>
      <button onClick={() => controller.saveTemplateVersion()}>version</button>
      <button onClick={() => controller.loadTemplate("saved")}>load</button>
      <button onClick={() => controller.startNewMapping()}>new</button>
      <button onClick={() => controller.cancelNewMapping()}>cancel</button>
    </div>
  )
}

const schema = {
  path: "$",
  type: "object" as const,
  required: true,
  examples: [],
}
const mappingSpec = {
  engine: "script_js" as const,
  script_version: 1,
  script: "function transform() { return { id: 1 }; }",
}
const templateVersion = {
  version: 1,
  source_format: "json" as const,
  target_format: "json" as const,
  source_schema_id: "source-live",
  target_schema_id: "target-live",
  source_schema_snapshot: schema,
  target_schema_snapshot: schema,
  mapping_spec: mappingSpec,
  validation_rules: [{ path: "$.id", message: "Required" }],
  field_validation_rules: [
    { path: "$.id", value_type: "string", required: true },
  ],
  sample_source_content: '{"id":1}',
  sample_target_content: '{"id":1}',
  created_at: "2026-06-19T00:00:00Z",
}
const savedTemplate = {
  template_id: "saved",
  name: "Saved",
  description: "",
  active_version: 1,
  is_seeded: false,
  versions: [templateVersion],
}
const versionedTemplate = {
  ...savedTemplate,
  active_version: 2,
  versions: [templateVersion, { ...templateVersion, version: 2 }],
}
const fieldRule = {
  schema_id: "target-live",
  path: "$.id",
  value_type: "string",
  required: true,
  min_value: null,
  max_value: null,
  min_length: 1,
  max_length: null,
  description: null,
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
}
