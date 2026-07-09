// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ValidationPanel } from "./ValidationPanel"

afterEach(cleanup)

describe("ValidationPanel", () => {
  it("describes JSON validation failures and schema checks", () => {
    render(
      <ValidationPanel
        outputFormat="json"
        errors={[
          {
            code: "missing_required_output_field",
            message:
              "Required target field $.tracking.number is missing from output.",
            path: "$.tracking.number",
          },
        ]}
      />
    )

    expect(screen.getByText(/active field validation rules/i)).toBeInstanceOf(
      HTMLElement
    )
    expect(screen.getByText("missing_required_output_field")).toBeInstanceOf(
      HTMLElement
    )
    expect(screen.getByText("$.tracking.number")).toBeInstanceOf(HTMLElement)
  })

  it("describes XML validation limitations as policy, not failure", () => {
    render(<ValidationPanel outputFormat="xml" errors={[]} />)

    expect(
      screen.getByText(
        /XML runs verify script execution and XML serialization/i
      )
    ).toBeInstanceOf(HTMLElement)
    expect(
      screen.getByText("No validation errors for the current policy.")
    ).toBeInstanceOf(HTMLElement)
  })

  it("adds field-rule helper copy for rule validation failures", () => {
    render(
      <ValidationPanel
        outputFormat="json"
        errors={[
          {
            code: "field_rule_min_value",
            message: "Field rule expects $.tracking.pieces to be at least 1.",
            path: "$.tracking.pieces",
            rule_id: "$.tracking.pieces",
          },
        ]}
      />
    )

    expect(screen.getByText("field_rule_min_value")).toBeInstanceOf(HTMLElement)
    expect(screen.getByText(/numeric min\/max limit/i)).toBeInstanceOf(
      HTMLElement
    )
  })
})
