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
    : "JSON runs check required target fields and scalar types when a target schema is available."

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
            </div>
          ))
        )}
      </div>
    </section>
  )
}
