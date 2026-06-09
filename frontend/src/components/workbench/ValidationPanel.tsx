import { CircleCheck, TriangleAlert } from "lucide-react"

import type { ValidationErrorItem } from "@/types/validation"

type Props = {
  errors: ValidationErrorItem[]
}

export function ValidationPanel({ errors }: Props) {
  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Validation</p>
          <h2>Runtime checks</h2>
        </div>
        {errors.length === 0 ? (
          <CircleCheck size={18} className="text-emerald-600" />
        ) : (
          <TriangleAlert size={18} className="text-amber-600" />
        )}
      </div>
      <div className="validation-stack">
        {errors.length === 0 ? (
          <p className="success-line">No validation errors.</p>
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

