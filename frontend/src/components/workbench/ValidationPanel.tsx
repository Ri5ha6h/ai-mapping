import { CircleCheck, TriangleAlert } from "lucide-react"

import type { OutputFormat } from "@/types/mapping"
import type { ValidationErrorItem } from "@/types/validation"

type Props = {
  errors: ValidationErrorItem[]
  outputFormat?: OutputFormat
}

export function ValidationPanel({ errors, outputFormat = "json" }: Props) {
  const policyText = outputFormat === "xml"
    ? "XML runs verify script execution and XML serialization. JSON target-schema field/type checks and XML structural diff are intentionally not applied."
    : "JSON runs check required target fields, scalar types, and active field validation rules when available."

  return (
    <section className="tool-panel validation-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Validation</p>
          <h2>Target checks</h2>
        </div>
        {errors.length === 0 ? (
          <CircleCheck size={18} className="text-emerald-600" />
        ) : (
          <TriangleAlert size={18} className="text-amber-600" />
        )}
      </div>
      <div className="validation-stack">
        <p className="empty-note">{policyText}</p>
        {errors.length === 0 ? (
          <p className="success-line">No validation errors for the current policy.</p>
        ) : (
          errors.map((error, index) => (
            <div className="validation-row" key={`${error.code}-${index}`}>
              <strong>{error.code}</strong>
              <span>{error.message}</span>
              {error.path ? <code>{error.path}</code> : null}
              {error.rule_id ? <small>{fieldRuleHelper(error)}</small> : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function fieldRuleHelper(error: ValidationErrorItem) {
  switch (error.code) {
    case "field_rule_required":
      return `Rule path ${error.rule_id} requires a non-empty output value.`
    case "field_rule_type_mismatch":
      return `Rule path ${error.rule_id} failed its configured type check.`
    case "field_rule_min_length":
    case "field_rule_max_length":
      return `Rule path ${error.rule_id} failed a configured string length limit.`
    case "field_rule_min_value":
    case "field_rule_max_value":
      return `Rule path ${error.rule_id} failed a configured numeric min/max limit.`
    default:
      return `Rule path ${error.rule_id}`
  }
}
