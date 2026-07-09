// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RunReviewPanel } from "./RunReviewPanel"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

afterEach(cleanup)

describe("RunReviewPanel", () => {
  it("shows saved-sample context and runs from Review", () => {
    const runTransform = vi.fn()
    render(
      <RunReviewPanel
        workbench={
          { ...baseWorkbench, runTransform } as unknown as ReturnType<
            typeof useMappingWorkbenchController
          >
        }
      />
    )

    expect(screen.getByText("Review cockpit")).toBeTruthy()
    expect(screen.getByText("Orders template v3")).toBeTruthy()
    expect(screen.getByText("Orders source saved sample")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Run Script" }))
    expect(runTransform).toHaveBeenCalledTimes(1)
  })

  it("switches to override input and edits payload", () => {
    const setRunMode = vi.fn()
    const setOverrideSourceInput = vi.fn()
    render(
      <RunReviewPanel
        workbench={
          {
            ...baseWorkbench,
            runMode: "override",
            overrideSourceInput: '{"id":"override"}',
            setRunMode,
            setOverrideSourceInput,
          } as unknown as ReturnType<typeof useMappingWorkbenchController>
        }
      />
    )

    expect(
      screen.getByText("Review will parse and run the override payload.")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Saved sample" }))
    expect(setRunMode).toHaveBeenCalledWith("saved-sample")

    fireEvent.change(screen.getByLabelText("Override source payload"), {
      target: { value: '{"id":"next"}' },
    })
    expect(setOverrideSourceInput).toHaveBeenCalledWith('{"id":"next"}')
  })

  it("disables Run Script until the mapping is executable", () => {
    render(
      <RunReviewPanel
        workbench={
          {
            ...baseWorkbench,
            readyForTransform: false,
          } as unknown as ReturnType<typeof useMappingWorkbenchController>
        }
      />
    )

    expect(screen.getByRole("button", { name: "Run Script" })).toHaveProperty(
      "disabled",
      true
    )
    expect(
      screen.getByText("Select schemas and author a script before running.")
    ).toBeTruthy()
  })
})

const baseWorkbench = {
  activeTemplate: {
    template_id: "orders",
    name: "Orders template",
    description: "",
    active_version: 3,
    is_seeded: false,
    versions: [],
  },
  selectedSourceSchema: { name: "Orders source" },
  activeSourceSchema: {
    path: "$",
    type: "object",
    required: true,
    examples: [],
  },
  runMode: "saved-sample",
  overrideSourceInput: "{}",
  readyForTransform: true,
  busyAction: null,
  fieldValidationRules: [
    { path: "$.id", value_type: "string", required: true },
  ],
  setRunMode: vi.fn(),
  setOverrideSourceInput: vi.fn(),
  runTransform: vi.fn(),
}
