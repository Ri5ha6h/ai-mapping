import { CircleCheck, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { OutputFormat } from "@/types/mapping"
import type { ValidationErrorItem } from "@/types/validation"
import { StatusAlert, WorkbenchCard } from "./ui"

type Props = {
  errors: ValidationErrorItem[]
  outputFormat?: OutputFormat
}

export function ValidationPanel({ errors, outputFormat = "json" }: Props) {
  const policyText = outputFormat === "xml"
    ? "XML runs verify script execution and XML serialization. JSON target-schema field/type checks and XML structural diff are intentionally not applied."
    : "JSON runs check required target fields, scalar types, and active field validation rules when available."

  return (
    <WorkbenchCard
      kicker="Validation"
      title="Target checks"
      icon={
        errors.length === 0 ? (
          <CircleCheck size={18} className="text-emerald-600" />
        ) : (
          <TriangleAlert size={18} className="text-amber-600" />
        )
      }
    >
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">{policyText}</p>
        {errors.length === 0 ? (
          <StatusAlert
            className="border-emerald-200 bg-emerald-50 text-emerald-950"
            title="No validation errors"
            description="No validation errors for the current policy."
          />
        ) : (
          errors.map((error, index) => (
            <div className="grid gap-1 rounded-lg border bg-card px-3 py-2" key={`${error.code}-${index}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{error.code}</Badge>
                {error.path ? <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{error.path}</code> : null}
              </div>
              <span className="text-sm">{error.message}</span>
              {error.rule_id ? <small className="text-xs text-muted-foreground">{fieldRuleHelper(error)}</small> : null}
            </div>
          ))
        )}
      </div>
    </WorkbenchCard>
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
