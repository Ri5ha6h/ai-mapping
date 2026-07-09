import { Suspense, lazy, memo, useMemo } from "react"
import { Bot, Braces, Loader2, Wand2 } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SegmentedControl, WorkbenchCard } from "./ui"

type AutoMapMode = "local" | "ai"
const MonacoEditor = lazy(() => import("@monaco-editor/react"))

type Props = {
  script: string
  explanation: string
  unresolvedPaths: string[]
  sourceReference: unknown
  sourceFormat: string
  statusText: string
  autoMapMode: AutoMapMode
  aiMappingAvailable: boolean
  canGenerate: boolean
  busyAction: string | null
  onScriptChange: (script: string) => void
  onGenerate: () => void
  onFieldHints: () => void
  onAutoMapModeChange: (mode: AutoMapMode) => void
}

export const ScriptWorkbench = memo(function ScriptWorkbenchView({
  script,
  explanation,
  unresolvedPaths,
  sourceReference,
  sourceFormat,
  statusText,
  autoMapMode,
  aiMappingAvailable,
  canGenerate,
  busyAction,
  onScriptChange,
  onGenerate,
  onFieldHints,
  onAutoMapModeChange,
}: Props) {
  const sourcePreview = useMemo(() => formatPreview(sourceReference), [sourceReference])

  return (
    <WorkbenchCard
      kicker="Transform function"
      title="JavaScript script"
      icon={<Braces size={18} />}
      className="script-workbench-panel"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Badge variant="outline" className="h-auto min-h-9 rounded-lg px-3 py-1.5" aria-live="polite">
          Stage: {statusText}
        </Badge>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={autoMapMode}
            ariaLabel="Auto map mode"
            disabled={Boolean(busyAction)}
            onValueChange={onAutoMapModeChange}
            options={[
              { value: "local", label: "Local" },
              {
                value: "ai",
                label: "AI-assisted",
                title: aiMappingAvailable
                  ? "Use OpenRouter-assisted script generation and hints"
                  : "Request AI assistance; backend will fall back to local generation if unavailable",
              },
            ]}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onFieldHints}
            disabled={!canGenerate || Boolean(busyAction)}
          >
            {busyAction === "Finding field hints" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Bot size={16} />
            )}
            Field hints
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={!canGenerate || Boolean(busyAction)}
          >
            {busyAction === "Generating script" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Wand2 size={16} />
            )}
            Generate script
          </Button>
        </div>
      </div>

      <div className="monaco-frame script-editor-frame">
        <Suspense fallback={<div className="editor-loading">Loading editor...</div>}>
          <MonacoEditor
            height="460px"
            defaultLanguage="javascript"
            language="javascript"
            theme="vs-dark"
            value={script}
            options={{
              automaticLayout: true,
              bracketPairColorization: { enabled: true },
              detectIndentation: false,
              fontSize: 13,
              formatOnPaste: true,
              formatOnType: true,
              insertSpaces: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: "on",
            }}
            onChange={(value) => onScriptChange(value ?? "")}
          />
        </Suspense>
      </div>

      <Accordion className="rounded-lg border bg-muted/30 px-3">
        <AccordionItem value="reference" className="border-0">
          <AccordionTrigger>Reference</AccordionTrigger>
          <AccordionContent className="pb-3">
        <div className="script-reference-grid">
          <div>
            <strong>source sample</strong>
            <pre>{sourcePreview}</pre>
          </div>
          <div>
            <strong>helpers</strong>
            <ul>
              <li>helpers.get(source, "$.path", "")</li>
              <li>helpers.default(value, fallback)</li>
              <li>helpers.clean(value)</li>
              <li>helpers.regexReplace(value, pattern, replacement)</li>
              <li>helpers.parseNumber(value, 0)</li>
              <li>helpers.formatDate(value, "YYYYMMDD", "YYYY-MM-DD")</li>
              <li>helpers.lookup(table, key, "")</li>
              <li>helpers.countryCode(value, "")</li>
              <li>helpers.omitEmpty(object)</li>
            </ul>
            <p>Current input format: {sourceFormat}. XML and EDI run as canonical JSON.</p>
          </div>
        </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {explanation ? <p className="rounded-lg border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground">{explanation}</p> : null}
      {unresolvedPaths.length > 0 ? (
        <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <strong>Review these target paths</strong>
          {unresolvedPaths.slice(0, 12).map((path) => (
            <span className="rounded bg-card px-2 py-1 font-mono text-xs text-muted-foreground" key={path}>{path}</span>
          ))}
          {unresolvedPaths.length > 12 ? <span className="text-sm text-muted-foreground">+{unresolvedPaths.length - 12} more</span> : null}
        </div>
      ) : null}
    </WorkbenchCard>
  )
})

function formatPreview(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return text.length > 2_400 ? `${text.slice(0, 2_400)}\n...` : text
}
