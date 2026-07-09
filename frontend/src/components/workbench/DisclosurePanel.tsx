import type { ReactNode } from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type Props = {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function DisclosurePanel({ title, summary, defaultOpen = false, children }: Props) {
  return (
    <Accordion
      defaultValue={defaultOpen ? ["details"] : []}
      className="rounded-lg border bg-muted/30 px-3"
    >
      <AccordionItem value="details" className="border-0">
        <AccordionTrigger>
          <span className="grid min-w-0 gap-0.5">
            <span>{title}</span>
            {summary ? (
              <span className="text-xs font-normal text-muted-foreground">{summary}</span>
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionContent className="grid gap-3 pb-3">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
