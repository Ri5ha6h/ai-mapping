import { Suspense, lazy, memo, useMemo } from "react"
import { Bot, Braces, Loader2, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"

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
    <section className="tool-panel script-workbench-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Transform function</p>
          <h2>JavaScript script</h2>
        </div>
        <Braces size={18} className="text-muted-foreground" />
      </div>

      <div className="script-toolbar">
        <div className="mapping-stage-status" aria-live="polite">
          <span>Stage</span>
          <strong>{statusText}</strong>
        </div>
        <div className="script-action-row">
          <div className="auto-map-mode" aria-label="Auto map mode">
            <button
              type="button"
              className={autoMapMode === "local" ? "active" : ""}
              onClick={() => onAutoMapModeChange("local")}
              disabled={Boolean(busyAction)}
            >
              Local
            </button>
            <button
              type="button"
              className={autoMapMode === "ai" ? "active" : ""}
              onClick={() => onAutoMapModeChange("ai")}
              disabled={Boolean(busyAction)}
              title={
                aiMappingAvailable
                  ? "Use OpenRouter-assisted script generation and hints"
                  : "Request AI assistance; backend will fall back to local generation if unavailable"
              }
            >
              AI-assisted
            </button>
          </div>
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

      <details className="script-reference">
        <summary>Reference</summary>
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
      </details>

      {explanation ? <p className="script-note">{explanation}</p> : null}
      {unresolvedPaths.length > 0 ? (
        <div className="unresolved-list">
          <strong>Review these target paths</strong>
          {unresolvedPaths.slice(0, 12).map((path) => (
            <span key={path}>{path}</span>
          ))}
          {unresolvedPaths.length > 12 ? <span>+{unresolvedPaths.length - 12} more</span> : null}
        </div>
      ) : null}
    </section>
  )
})

function formatPreview(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return text.length > 2_400 ? `${text.slice(0, 2_400)}\n...` : text
}
