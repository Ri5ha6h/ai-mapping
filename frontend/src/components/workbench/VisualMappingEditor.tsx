import { memo, useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MappingRule, RuleType } from "@/types/mapping"

type Props = {
  rules: MappingRule[]
  onRulesChange: (rules: MappingRule[]) => void
}

const ruleTypes: RuleType[] = ["field", "constant", "concat", "date_format", "condition", "loop"]

export const VisualMappingEditor = memo(function VisualMappingEditor({ rules, onRulesChange }: Props) {
  return (
    <section className="tool-panel editor-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Mapping rules</p>
          <h2>Visual editor</h2>
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
                aria-label={`Rule ${index + 1} type`}
                value={rule.type}
                onChange={(event) => replaceRule(index, normalizeRuleForType(rule, event.target.value as RuleType))}
              >
                {ruleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Rule ${index + 1} source`}
                value={sourceDisplay(rule)}
                onChange={(event) => updateSource(index, event.target.value)}
                disabled={rule.type === "constant"}
              />
              <Input
                aria-label={`Rule ${index + 1} target`}
                value={rule.target_path}
                onChange={(event) => updateTarget(index, event.target.value)}
              />
              <RuleDetails rule={rule} onChange={(patch) => updateRule(index, patch)} />
              <Input
                aria-label={`Rule ${index + 1} JSONata`}
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

  function replaceRule(index: number, nextRule: MappingRule) {
    onRulesChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? nextRule : rule)))
  }

  function updateSource(index: number, source: string) {
    const rule = rules[index]
    if (rule.type === "concat") {
      updateRule(index, { source_paths: parsePathList(source), source_path: source })
      return
    }
    if (rule.type === "condition") {
      updateRule(index, {
        source_path: source,
        condition: { ...defaultCondition(rule), source_path: source },
      })
      return
    }
    if (rule.type === "loop") {
      updateRule(index, {
        source_path: source,
        loop: { ...defaultLoop(rule), source_path: source },
      })
      return
    }
    updateRule(index, { source_path: source })
  }

  function updateTarget(index: number, target: string) {
    const rule = rules[index]
    if (rule.type === "loop") {
      updateRule(index, {
        target_path: target,
        loop: { ...defaultLoop(rule), target_path: target },
      })
      return
    }
    updateRule(index, { target_path: target })
  }
})

type RuleDetailsProps = {
  rule: MappingRule
  onChange: (patch: Partial<MappingRule>) => void
}

function RuleDetails({ rule, onChange }: RuleDetailsProps) {
  if (rule.type === "constant") {
    return (
      <Input
        aria-label="Constant value"
        value={stringifyEditableValue(rule.value)}
        onChange={(event) => onChange({ value: parseEditableValue(event.target.value) })}
        placeholder="value"
      />
    )
  }

  if (rule.type === "concat") {
    return (
      <Input
        aria-label="Concat separator"
        value={rule.separator ?? ""}
        onChange={(event) => onChange({ separator: event.target.value })}
        placeholder="separator"
      />
    )
  }

  if (rule.type === "date_format") {
    return (
      <div className="rule-detail-grid">
        <Input
          aria-label="Input date format"
          value={rule.input_format ?? "%Y%m%d"}
          onChange={(event) => onChange({ input_format: event.target.value })}
          placeholder="input"
        />
        <Input
          aria-label="Output date format"
          value={rule.output_format ?? "%Y-%m-%d"}
          onChange={(event) => onChange({ output_format: event.target.value })}
          placeholder="output"
        />
      </div>
    )
  }

  if (rule.type === "condition") {
    const condition = defaultCondition(rule)
    return (
      <div className="rule-detail-grid condition-detail-grid">
        <Input
          aria-label="Condition equals"
          value={stringifyEditableValue(condition.equals)}
          onChange={(event) =>
            onChange({ condition: { ...condition, equals: parseEditableValue(event.target.value) } })
          }
          placeholder="equals"
        />
        <Input
          aria-label="Condition then"
          value={stringifyEditableValue(condition.then)}
          onChange={(event) =>
            onChange({ condition: { ...condition, then: parseEditableValue(event.target.value) } })
          }
          placeholder="then"
        />
        <Input
          aria-label="Condition otherwise"
          value={stringifyEditableValue(condition.otherwise)}
          onChange={(event) =>
            onChange({ condition: { ...condition, otherwise: parseEditableValue(event.target.value) } })
          }
          placeholder="otherwise"
        />
      </div>
    )
  }

  if (rule.type === "loop") {
    return <LoopRulesInput rule={rule} onChange={onChange} />
  }

  return (
    <label className="required-toggle">
      <input
        type="checkbox"
        checked={rule.required !== false}
        onChange={(event) => onChange({ required: event.target.checked })}
      />
      Required
    </label>
  )
}

function LoopRulesInput({ rule, onChange }: RuleDetailsProps) {
  const loop = defaultLoop(rule)
  const [draft, setDraft] = useState(() => JSON.stringify(loop.rules))

  useEffect(() => {
    setDraft(JSON.stringify(defaultLoop(rule).rules))
  }, [rule.id, rule.loop?.rules])

  return (
    <Input
      aria-label="Loop child rules JSON"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const childRules = parseChildRules(draft)
        if (childRules) onChange({ loop: { ...defaultLoop(rule), rules: childRules } })
      }}
      placeholder="child rules JSON"
    />
  )
}

export function sourceDisplay(rule: MappingRule) {
  if (rule.type === "concat") {
    return rule.source_path ?? rule.source_paths?.join(", ") ?? ""
  }
  if (rule.type === "condition" && rule.condition) {
    return rule.condition.source_path
  }
  if (rule.type === "loop" && rule.loop) {
    return rule.loop.source_path
  }
  return rule.source_path ?? ""
}

export function normalizeRuleForType(rule: MappingRule, type: RuleType): MappingRule {
  const base = {
    ...rule,
    type,
    source_path: rule.source_path ?? "$.",
    jsonata: rule.jsonata ?? "",
  }

  if (type === "constant") {
    return { ...base, source_path: null, value: rule.value ?? "" }
  }
  if (type === "concat") {
    const sourcePaths = rule.source_paths && rule.source_paths.length > 0 ? rule.source_paths : parsePathList(rule.source_path)
    return { ...base, source_path: sourcePaths.join(", "), source_paths: sourcePaths, separator: rule.separator ?? "" }
  }
  if (type === "date_format") {
    return {
      ...base,
      input_format: rule.input_format ?? "%Y%m%d",
      output_format: rule.output_format ?? "%Y-%m-%d",
    }
  }
  if (type === "condition") {
    const condition = defaultCondition(rule)
    return { ...base, source_path: condition.source_path, condition }
  }
  if (type === "loop") {
    const loop = defaultLoop(rule)
    return { ...base, source_path: loop.source_path, target_path: loop.target_path, loop }
  }
  return base
}

function defaultCondition(rule: MappingRule) {
  return {
    source_path: rule.condition?.source_path ?? rule.source_path ?? "$.",
    equals: rule.condition?.equals ?? "",
    then: rule.condition?.then ?? "",
    otherwise: rule.condition?.otherwise ?? null,
  }
}

function defaultLoop(rule: MappingRule) {
  return {
    source_path: rule.loop?.source_path ?? rule.source_path ?? "$.",
    target_path: rule.loop?.target_path ?? rule.target_path,
    rules: rule.loop?.rules ?? [],
  }
}

export function parsePathList(value: string | null | undefined) {
  return (value ?? "").split(",").flatMap((path) => {
    const trimmedPath = path.trim()
    return trimmedPath ? [trimmedPath] : []
  })
}

function stringifyEditableValue(value: unknown) {
  if (value === undefined || value === null) return ""
  return typeof value === "string" ? value : JSON.stringify(value)
}

function parseEditableValue(value: string) {
  if (value.trim() === "") return ""
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function parseChildRules(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as MappingRule[]) : null
  } catch {
    return null
  }
}

function newRule(): MappingRule {
  return {
    id: `rule_${crypto.randomUUID()}`,
    type: "field",
    source_path: "$.",
    target_path: "$.",
    jsonata: "",
  }
}
