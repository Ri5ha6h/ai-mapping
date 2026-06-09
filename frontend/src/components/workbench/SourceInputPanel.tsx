import { Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { SourceFormat } from "@/types/mapping"

type Props = {
  value: string
  format: SourceFormat
  onValueChange: (value: string) => void
  onFormatChange: (format: SourceFormat) => void
}

const sourceFormats: Array<{ value: SourceFormat; label: string }> = [
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "edi_214", label: "EDI 214" },
  { value: "edi_856", label: "EDI 856" },
]

export function SourceInputPanel({ value, format, onValueChange, onFormatChange }: Props) {
  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Source</p>
          <h2>Inbound payload</h2>
        </div>
        <label className="icon-button" title="Upload source file">
          <Upload size={16} />
          <input
            className="hidden"
            type="file"
            onChange={(event) => void readFile(event.currentTarget.files?.[0], onValueChange)}
          />
        </label>
      </div>
      <div className="format-row">
        {sourceFormats.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={format === item.value ? "default" : "outline"}
            size="sm"
            onClick={() => onFormatChange(item.value)}
          >
            {item.label}
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

