import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type Props = {
  step: number
  title: string
  status: string
  blocker?: string | null
  action?: ReactNode
  children: ReactNode
  secondary?: ReactNode
}

export function WorkflowStep({
  step,
  title,
  status,
  blocker,
  action,
  children,
  secondary,
}: Props) {
  return (
    <Card
      className="manifest-panel min-w-0"
      aria-labelledby={`workflow-step-${step}`}
    >
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-sm border border-primary/20 bg-primary font-mono text-sm font-bold text-primary-foreground shadow-sm"
          >
            {step}
          </span>
          <div className="min-w-0">
            <p className="manifest-kicker mb-0.5 text-[10px] leading-none font-bold text-muted-foreground uppercase">
              Leg {step}
            </p>
            <h2
              id={`workflow-step-${step}`}
              className="text-base leading-snug font-semibold"
            >
              {title}
            </h2>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          <Badge
            variant="outline"
            className="manifest-status h-auto min-h-6 max-w-full rounded-sm py-1 font-mono text-[11px] text-wrap"
          >
            {status}
          </Badge>
          {action}
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        {blocker ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {blocker}
          </p>
        ) : null}
        <div className="grid min-w-0 gap-3">{children}</div>
        {secondary ? (
          <div className="grid min-w-0 gap-3">{secondary}</div>
        ) : null}
      </CardContent>
    </Card>
  )
}
