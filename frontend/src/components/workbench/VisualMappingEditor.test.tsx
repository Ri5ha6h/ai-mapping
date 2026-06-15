// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useState } from "react"

import type { MappingRule } from "@/types/mapping"
import {
  normalizeRuleForType,
  parsePathList,
  sourceDisplay,
  VisualMappingEditor,
} from "./VisualMappingEditor"

afterEach(cleanup)

describe("VisualMappingEditor", () => {
  it("preserves a trailing comma while editing concat source paths", () => {
    const initialRule: MappingRule = {
      id: "concat-rule",
      type: "concat",
      source_path: "$.customer.firstName",
      source_paths: ["$.customer.firstName"],
      target_path: "$.customer.fullName",
      separator: " ",
      jsonata: "",
    }

    render(<RuleHarness initialRules={[initialRule]} />)

    const sourceInput = screen.getByLabelText("Rule 1 source")
    fireEvent.change(sourceInput, {
      target: { value: "$.customer.firstName," },
    })

    expect((sourceInput as HTMLInputElement).value).toBe("$.customer.firstName,")
    const rulesJson = screen.getByTestId("rules-json").textContent
    expect(rulesJson).toContain('"source_path":"$.customer.firstName,"')
    expect(rulesJson).toContain('"source_paths":["$.customer.firstName"]')
  })

  it("updates condition source state without losing condition details", () => {
    const initialRule: MappingRule = {
      id: "condition-rule",
      type: "condition",
      source_path: "$.customer.tier",
      target_path: "$.customer.serviceLevel",
      condition: {
        source_path: "$.customer.tier",
        equals: "gold",
        then: "priority",
        otherwise: "standard",
      },
      jsonata: "",
    }

    render(<RuleHarness initialRules={[initialRule]} />)

    fireEvent.change(screen.getByLabelText("Rule 1 source"), {
      target: { value: "$.customer.segment" },
    })

    const rulesJson = screen.getByTestId("rules-json").textContent
    expect(rulesJson).toContain('"source_path":"$.customer.segment"')
    expect(rulesJson).toContain('"equals":"gold"')
    expect(rulesJson).toContain('"then":"priority"')
    expect(rulesJson).toContain('"otherwise":"standard"')
  })

  it("updates loop source and target state without losing child rules", () => {
    const childRule: MappingRule = {
      id: "loop-child",
      type: "field",
      source_path: "$.id",
      target_path: "$.id",
    }
    const initialRule: MappingRule = {
      id: "loop-rule",
      type: "loop",
      source_path: "$.shipment.packages",
      target_path: "$.packages",
      loop: {
        source_path: "$.shipment.packages",
        target_path: "$.packages",
        rules: [childRule],
      },
      jsonata: "",
    }

    render(<RuleHarness initialRules={[initialRule]} />)

    fireEvent.change(screen.getByLabelText("Rule 1 source"), {
      target: { value: "$.shipment.items" },
    })
    fireEvent.change(screen.getByLabelText("Rule 1 target"), {
      target: { value: "$.items" },
    })

    const rulesJson = screen.getByTestId("rules-json").textContent
    expect(rulesJson).toContain('"source_path":"$.shipment.items"')
    expect(rulesJson).toContain('"target_path":"$.items"')
    expect(rulesJson).toContain('"id":"loop-child"')
  })

  it("allows loop child rules JSON to be edited before committing valid JSON on blur", () => {
    const initialRule: MappingRule = {
      id: "loop-rule",
      type: "loop",
      source_path: "$.shipment.packages",
      target_path: "$.packages",
      loop: {
        source_path: "$.shipment.packages",
        target_path: "$.packages",
        rules: [],
      },
      jsonata: "",
    }

    render(<RuleHarness initialRules={[initialRule]} />)

    const childRulesInput = screen.getByLabelText("Loop child rules JSON")
    fireEvent.change(childRulesInput, { target: { value: '[{"id":' } })
    expect((childRulesInput as HTMLInputElement).value).toBe('[{"id":')

    const validChildRules = JSON.stringify([
      { id: "child", type: "field", source_path: "$.id", target_path: "$.id" },
    ])
    fireEvent.change(childRulesInput, { target: { value: validChildRules } })
    fireEvent.blur(childRulesInput)

    expect(screen.getByTestId("rules-json").textContent).toContain('"id":"child"')
  })
})

describe("VisualMappingEditor helpers", () => {
  it("displays raw concat source text before parsed source paths", () => {
    expect(
      sourceDisplay({
        id: "concat-rule",
        type: "concat",
        source_path: "$.first,",
        source_paths: ["$.first"],
        target_path: "$.fullName",
      })
    ).toBe("$.first,")
  })

  it("parses comma-separated paths without empty items", () => {
    expect(parsePathList("$.first, $.last,")).toEqual(["$.first", "$.last"])
  })

  it("normalizes concat rules from a field source path", () => {
    const rule = normalizeRuleForType(
      {
        id: "field-rule",
        type: "field",
        source_path: "$.first",
        target_path: "$.fullName",
      },
      "concat"
    )

    expect(rule.source_path).toBe("$.first")
    expect(rule.source_paths).toEqual(["$.first"])
    expect(rule.separator).toBe("")
  })
})

function RuleHarness({ initialRules }: { initialRules: MappingRule[] }) {
  const [rules, setRules] = useState(initialRules)

  return (
    <>
      <VisualMappingEditor rules={rules} onRulesChange={setRules} />
      <pre data-testid="rules-json">{JSON.stringify(rules)}</pre>
    </>
  )
}
