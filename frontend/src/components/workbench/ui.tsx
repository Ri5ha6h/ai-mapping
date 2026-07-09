import type { ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type WorkbenchCardProps = {
  title: ReactNode
  kicker?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function WorkbenchCard({
  title,
  kicker,
  description,
  icon,
  action,
  children,
  className,
  contentClassName,
}: WorkbenchCardProps) {
  return (
    <Card className={cn("min-w-0 shadow-sm", className)}>
      <PanelHeader
        title={title}
        kicker={kicker}
        description={description}
        icon={icon}
        action={action}
      />
      <CardContent className={cn("grid min-w-0 gap-3", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

type PanelHeaderProps = {
  title: ReactNode
  kicker?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function PanelHeader({
  title,
  kicker,
  description,
  icon,
  action,
  className,
}: PanelHeaderProps) {
  return (
    <CardHeader className={cn("gap-1", className)}>
      <div className="min-w-0">
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <h2 className="truncate font-heading text-base font-medium leading-snug">
          {title}
        </h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {action ?? (icon ? <CardAction className="text-muted-foreground">{icon}</CardAction> : null)}
    </CardHeader>
  )
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-0.5 text-[11px] font-bold uppercase leading-none text-muted-foreground">
      {children}
    </p>
  )
}

type FieldProps = {
  label: ReactNode
  htmlFor?: string
  description?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}

export function Field({
  label,
  htmlFor,
  description,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs leading-relaxed text-destructive">{error}</p>
      ) : description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

type SegmentedOption<TValue extends string> = {
  value: TValue
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
  title?: string
}

type SegmentedControlProps<TValue extends string> = {
  value: TValue
  options: Array<SegmentedOption<TValue>>
  onValueChange: (value: TValue) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

export function SegmentedControl<TValue extends string>({
  value,
  options,
  onValueChange,
  disabled = false,
  ariaLabel,
  className,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center gap-1 rounded-lg border bg-card/90 p-1",
        className
      )}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            value === option.value && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
          title={option.title}
          aria-pressed={value === option.value}
          disabled={disabled || option.disabled}
          onClick={() => onValueChange(option.value)}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

type SelectOption<TValue extends string> = {
  value: TValue
  label: ReactNode
  disabled?: boolean
}

type SelectFieldProps<TValue extends string> = {
  label: ReactNode
  value: TValue
  placeholder?: ReactNode
  options: Array<SelectOption<TValue>>
  onValueChange: (value: TValue) => void
  className?: string
  triggerClassName?: string
}

export function SelectField<TValue extends string>({
  label,
  value,
  placeholder = "Select",
  options,
  onValueChange,
  className,
  triggerClassName,
}: SelectFieldProps<TValue>) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={(nextValue) => {
        if (nextValue !== null) onValueChange(nextValue)
      }}>
        <SelectTrigger
          aria-label={typeof label === "string" ? label : undefined}
          className={cn("w-full", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

type StatusAlertProps = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  variant?: "default" | "destructive"
  className?: string
}

export function StatusAlert({
  title,
  description,
  icon,
  variant = "default",
  className,
}: StatusAlertProps) {
  return (
    <Alert variant={variant} className={className}>
      {icon}
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  )
}

export function StatusBadge({
  children,
  variant = "outline",
  className,
}: {
  children: ReactNode
  variant?: "default" | "secondary" | "destructive" | "outline"
  className?: string
}) {
  return (
    <Badge variant={variant} className={cn("max-w-full", className)}>
      <span className="truncate">{children}</span>
    </Badge>
  )
}
