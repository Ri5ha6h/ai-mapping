// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MappingSchemaPanel } from "./MappingSchemaPanel"
import type { useMappingWorkbenchController } from "./useMappingWorkbenchController"

afterEach(cleanup)

describe("MappingSchemaPanel", () => {
  it("keeps transform actions out of schema selection", () => {
    render(
      <MappingSchemaPanel
        workbench={baseWorkbench as unknown as ReturnType<typeof useMappingWorkbenchController>}
        sourceSchemas={[]}
        targetSchemas={[]}
        onOpenSchemaTab={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "New Transform" })).toBeInstanceOf(HTMLButtonElement)
    expect(screen.queryByRole("button", { name: "AI-assisted" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Field hints" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Run script" })).toBeNull()
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
