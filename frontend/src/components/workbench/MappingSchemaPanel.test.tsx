// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MappingSchemaPanel } from "./MappingSchemaPanel"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

afterEach(cleanup)

describe("MappingSchemaPanel", () => {
  it("keeps AI-assisted mode visible and selectable when capability metadata is unavailable", () => {
    const setAutoMapMode = vi.fn()

    render(
      <MappingSchemaPanel
        workbench={
          {
            ...baseWorkbench,
            aiMappingAvailable: false,
            autoMapMode: "local",
            setAutoMapMode,
          } as unknown as ReturnType<typeof useMappingWorkbenchController>
        }
        sourceSchemas={[]}
        targetSchemas={[]}
        onOpenSchemaTab={vi.fn()}
      />
    )

    const aiModeButton = screen.getByRole("button", { name: "AI-assisted" })
    expect(aiModeButton).toBeInstanceOf(HTMLButtonElement)
    expect((aiModeButton as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(aiModeButton)

    expect(setAutoMapMode).toHaveBeenCalledWith("ai")
  })
})

const baseWorkbench = {
  selectedSourceSchemaId: "",
  selectedTargetSchemaId: "",
  selectedSourceSchema: null,
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
