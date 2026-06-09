import { useEffect, useState } from "react"

import { Textarea } from "@/components/ui/textarea"
import type MonacoEditor from "@monaco-editor/react"

type MonacoEditorComponent = typeof MonacoEditor

type Props = {
  value: string
  onChange: (value: string) => void
}

export function JsonataEditor({ value, onChange }: Props) {
  const [Editor, setEditor] = useState<MonacoEditorComponent | null>(null)

  useEffect(() => {
    let mounted = true
    void import("@monaco-editor/react").then((module) => {
      if (mounted) setEditor(() => module.default)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Advanced</p>
          <h2>JSONata expression</h2>
        </div>
      </div>
      <div className="monaco-frame">
        {Editor ? (
          <Editor
            height="260px"
            defaultLanguage="json"
            value={value}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
            onChange={(nextValue) => onChange(nextValue ?? "")}
          />
        ) : (
          <Textarea
            className="code-input min-h-64 border-0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
          />
        )}
      </div>
    </section>
  )
}
