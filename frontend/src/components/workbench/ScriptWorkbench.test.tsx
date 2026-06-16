// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ScriptWorkbench } from "./ScriptWorkbench"

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string | undefined) => void
  }) => (
    <textarea
      aria-label="Monaco script editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

afterEach(cleanup)

describe("ScriptWorkbench", () => {
  it("contains mode, hint, generate, run, reference, and editable script controls", () => {
    const onAutoMapModeChange = vi.fn()
    const onFieldHints = vi.fn()
    const onGenerate = vi.fn()
    const onRun = vi.fn()
    const onScriptChange = vi.fn()

    render(
      <ScriptWorkbench
        script="function transform(source, helpers) { return {}; }"
        explanation=""
        unresolvedPaths={[]}
        sourceReference={{ first: "hello" }}
        sourceFormat="json"
        statusText="Ready to run script"
        autoMapMode="local"
        aiMappingAvailable={false}
        canGenerate
        canRun
        busyAction={null}
        onScriptChange={onScriptChange}
        onGenerate={onGenerate}
        onRun={onRun}
        onFieldHints={onFieldHints}
        onAutoMapModeChange={onAutoMapModeChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "AI-assisted" }))
    fireEvent.click(screen.getByRole("button", { name: "Field hints" }))
    fireEvent.click(screen.getByRole("button", { name: "Generate script" }))
    fireEvent.click(screen.getByRole("button", { name: "Run script" }))
    fireEvent.change(screen.getByLabelText("Monaco script editor"), {
      target: { value: "function transform(source, helpers) { return source; }" },
    })

    expect(onAutoMapModeChange).toHaveBeenCalledWith("ai")
    expect(onFieldHints).toHaveBeenCalled()
    expect(onGenerate).toHaveBeenCalled()
    expect(onRun).toHaveBeenCalled()
    expect(onScriptChange).toHaveBeenCalledWith(
      "function transform(source, helpers) { return source; }"
    )
    expect(screen.getByText("Reference")).toBeInstanceOf(HTMLElement)
  })
})
