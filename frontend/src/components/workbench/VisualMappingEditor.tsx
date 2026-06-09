import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MappingRule, RuleType } from "@/types/mapping"

type Props = {
  rules: MappingRule[]
  onRulesChange: (rules: MappingRule[]) => void
}

const ruleTypes: RuleType[] = ["field", "constant", "concat", "date_format", "condition", "loop"]

export function VisualMappingEditor({ rules, onRulesChange }: Props) {
  return (
    <section className="tool-panel editor-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Editor</p>
          <h2>Visual rules</h2>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onRulesChange([...rules, newRule()])}>
          Add rule
        </Button>
      </div>
      <div className="rule-table">
        <div className="rule-head">
          <span>Type</span>
          <span>Source</span>
          <span>Target</span>
          <span>Details</span>
          <span>JSONata</span>
          <span />
        </div>
        {rules.length === 0 ? (
          <p className="empty-line">No editable rules yet.</p>
        ) : (
          rules.map((rule, index) => (
            <div className="rule-row" key={rule.id}>
              <select
                value={rule.type}
                onChange={(event) => updateRule(index, { type: event.target.value as RuleType })}
              >
                {ruleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Input
                value={sourceDisplay(rule)}
                onChange={(event) => updateRule(index, { source_path: event.target.value })}
              />
              <Input
                value={rule.target_path}
                onChange={(event) => updateRule(index, { target_path: event.target.value })}
              />
              <div className="rule-detail" title={ruleDetail(rule)}>
                {ruleDetail(rule)}
              </div>
              <Input
                value={rule.jsonata ?? ""}
                onChange={(event) => updateRule(index, { jsonata: event.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Remove rule"
                onClick={() => onRulesChange(rules.filter((_, ruleIndex) => ruleIndex !== index))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  )

  function updateRule(index: number, patch: Partial<MappingRule>) {
    onRulesChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
  }
}

function sourceDisplay(rule: MappingRule) {
  if (rule.type === "concat" && rule.source_paths && rule.source_paths.length > 0) {
    return rule.source_paths.join(", ")
  }
  if (rule.type === "condition" && rule.condition) {
    return rule.condition.source_path
  }
  if (rule.type === "loop" && rule.loop) {
    return rule.loop.source_path
  }
  return rule.source_path ?? ""
}

function ruleDetail(rule: MappingRule) {
  if (rule.type === "constant") {
    return `value ${formatValue(rule.value)}`
  }
  if (rule.type === "concat") {
    return `join ${rule.source_paths?.length ?? 0} path(s) with ${formatValue(rule.separator ?? "")}`
  }
  if (rule.type === "date_format") {
    return `${rule.input_format ?? "%Y%m%d"} -> ${rule.output_format ?? "%Y-%m-%d"}`
  }
  if (rule.type === "condition" && rule.condition) {
    return `if equals ${formatValue(rule.condition.equals)} then ${formatValue(rule.condition.then)} else ${formatValue(rule.condition.otherwise)}`
  }
  if (rule.type === "loop" && rule.loop) {
    return `${rule.loop.source_path} -> ${rule.loop.target_path}; ${rule.loop.rules.length} child rule(s)`
  }
  return rule.required === false ? "optional" : "required"
}

function formatValue(value: unknown) {
  if (typeof value === "string") return `"${value}"`
  return JSON.stringify(value)
}

function newRule(): MappingRule {
  return {
    id: `rule_${Date.now()}`,
    type: "field",
    source_path: "$.",
    target_path: "$.",
    jsonata: "",
  }
}
