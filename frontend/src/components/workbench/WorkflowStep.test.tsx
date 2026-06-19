// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DisclosurePanel } from "./DisclosurePanel"
import { WorkflowStep } from "./WorkflowStep"

afterEach(cleanup)

describe("WorkflowStep", () => {
  it("renders numbered status, blockers, actions, and reachable disclosure content", () => {
    render(
      <WorkflowStep
        step={2}
        title="Author"
        status="Script ready"
        blocker="Provider fallback used."
        action={<button type="button">Primary action</button>}
        secondary={
          <DisclosurePanel title="Secondary details">
            <p>Hidden until expanded but reachable</p>
          </DisclosurePanel>
        }
      >
        <p>Main authoring surface</p>
      </WorkflowStep>
    )

    expect(screen.getByRole("heading", { name: "Author" })).toBeTruthy()
    expect(screen.getByText("Script ready")).toBeTruthy()
    expect(screen.getByText("Provider fallback used.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Primary action" })).toBeTruthy()
    expect(screen.getByText("Secondary details")).toBeTruthy()
    expect(screen.getByText("Hidden until expanded but reachable")).toBeTruthy()
  })
})
