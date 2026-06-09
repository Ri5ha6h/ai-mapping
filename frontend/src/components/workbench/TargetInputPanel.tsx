import { Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { OutputFormat } from "@/types/mapping"

type Props = {
  value: string
  format: OutputFormat
  onValueChange: (value: string) => void
  onFormatChange: (format: OutputFormat) => void
}

export function TargetInputPanel({ value, format, onValueChange, onFormatChange }: Props) {
  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Target</p>
          <h2>Output sample</h2>
        </div>
        <label className="icon-button" title="Upload target sample">
          <Upload size={16} />
          <input
            className="hidden"
            type="file"
            onChange={(event) => void readFile(event.currentTarget.files?.[0], onValueChange)}
          />
        </label>
      </div>
      <div className="format-row">
        {(["json", "xml"] as const).map((item) => (
          <Button
            key={item}
            type="button"
            variant={format === item ? "default" : "outline"}
            size="sm"
            onClick={() => onFormatChange(item)}
          >
            {item.toUpperCase()}
          </Button>
        ))}
      </div>
      <Textarea
        className="code-input min-h-72"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        spellCheck={false}
      />
    </section>
  )
}

async function readFile(file: File | undefined, onValueChange: (value: string) => void) {
  if (!file) return
  onValueChange(await file.text())
}

