import type { ReactNode } from "react"

type Props = {
  step: number
  title: string
  status: string
  blocker?: string | null
  action?: ReactNode
  children: ReactNode
  secondary?: ReactNode
}

export function WorkflowStep({ step, title, status, blocker, action, children, secondary }: Props) {
  return (
    <section className="workflow-step" aria-labelledby={`workflow-step-${step}`}>
      <div className="workflow-step-header">
        <div className="workflow-step-title">
          <span aria-hidden="true">{step}</span>
          <div>
            <p className="panel-kicker">Step {step}</p>
            <h2 id={`workflow-step-${step}`}>{title}</h2>
          </div>
        </div>
        <div className="workflow-step-meta">
          <strong>{status}</strong>
          {action}
        </div>
      </div>
      {blocker ? <p className="workflow-step-blocker">{blocker}</p> : null}
      <div className="workflow-step-body">{children}</div>
      {secondary ? <div className="workflow-step-secondary">{secondary}</div> : null}
    </section>
  )
}
