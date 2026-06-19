import type { ReactNode } from "react"

type Props = {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function DisclosurePanel({ title, summary, defaultOpen = false, children }: Props) {
  return (
    <details className="disclosure-panel" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {summary ? <small>{summary}</small> : null}
      </summary>
      <div className="disclosure-panel-content">{children}</div>
    </details>
  )
}
