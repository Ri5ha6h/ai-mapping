// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { OutputDiffPanel } from "./OutputDiffPanel"

afterEach(cleanup)

describe("OutputDiffPanel", () => {
  it("renders available JSON differences", () => {
    render(
      <OutputDiffPanel
        outputFormat="json"
        hasRun
        diffs={[
          {
            kind: "changed",
            path: "$.tracking.number",
            expected: "A",
            actual: "B",
          },
        ]}
      />
    )

    expect(screen.getByText("changed")).toBeInstanceOf(HTMLElement)
    expect(screen.getByText("$.tracking.number")).toBeInstanceOf(HTMLElement)
  })

  it("distinguishes empty JSON diff from not-yet-run state", () => {
    render(<OutputDiffPanel outputFormat="json" hasRun diffs={[]} />)

    expect(
      screen.getByText("No output differences after the last JSON run.")
    ).toBeInstanceOf(HTMLElement)
  })

  it("renders unsupported XML diff state", () => {
    render(<OutputDiffPanel outputFormat="xml" hasRun diffs={[]} />)

    expect(
      screen.getByText(/Diff is not available for XML output/i)
    ).toBeInstanceOf(HTMLElement)
  })
})
