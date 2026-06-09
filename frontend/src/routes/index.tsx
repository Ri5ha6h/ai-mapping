import { useEffect, useMemo, useState } from "react"
import { Effect } from "effect"
import {
  Bot,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { createFileRoute } from "@tanstack/react-router"

import { DemoScenarioPanel } from "@/components/workbench/DemoScenarioPanel"
import type { DemoScenario } from "@/components/workbench/DemoScenarioPanel"
import { JsonataEditor } from "@/components/workbench/JsonataEditor"
import { MappingSuggestionPanel } from "@/components/workbench/MappingSuggestionPanel"
import { OutputPreview } from "@/components/workbench/OutputPreview"
import { SchemaViewer } from "@/components/workbench/SchemaViewer"
import { SourceInputPanel } from "@/components/workbench/SourceInputPanel"
import { TargetInputPanel } from "@/components/workbench/TargetInputPanel"
import { TemplateVersionPanel } from "@/components/workbench/TemplateVersionPanel"
import { ValidationPanel } from "@/components/workbench/ValidationPanel"
import { VisualMappingEditor } from "@/components/workbench/VisualMappingEditor"
import {
  SAMPLE_EDI_214,
  SAMPLE_EDI_856,
  SAMPLE_SOURCE_XML,
  SAMPLE_SOURCE_JSON,
  SAMPLE_TARGET_JSON,
  SAMPLE_TARGET_XML,
} from "@/components/workbench/constants"
import { Button } from "@/components/ui/button"
import { issueFromUnknown } from "@/lib/effect/errors"
import type { FrontendIssue } from "@/lib/effect/errors"
import {
  createTemplateEffect,
  createTemplateVersionEffect,
  getMappingCapabilitiesEffect,
  getTemplateEffect,
  inferSchemaEffect,
  listTemplatesEffect,
  parseEffect,
  suggestMappingsEffect,
  transformEffect,
  validateEffect,
} from "@/lib/effect/api_effects"
import type {
  MappingRule,
  MappingTemplate,
  MappingSuggestion,
  OutputFormat,
  SourceFormat,
  TransformResponse,
} from "@/types/mapping"
import type { SchemaNode } from "@/types/schema"
import type { ValidationErrorItem } from "@/types/validation"

export const Route = createFileRoute("/")({ component: MappingWorkbench })

type AutoMapMode = "local" | "ai"
type AutoMapStatus = "idle" | "local" | "ai-used" | "ai-unavailable" | "ai-fallback"

const demoScenarios: DemoScenario[] = [
  {
    id: "json-json",
    label: "JSON to JSON",
    description: "Shipment JSON to normalized JSON event output.",
    sourceFormat: "json",
    targetFormat: "json",
    source: SAMPLE_SOURCE_JSON,
    target: SAMPLE_TARGET_JSON,
    icon: "json",
  },
  {
    id: "xml-json",
    label: "XML to JSON",
    description: "Shipment XML canonicalized to JSON, then mapped to the JSON target.",
    sourceFormat: "xml",
    targetFormat: "json",
    source: SAMPLE_SOURCE_XML,
    target: SAMPLE_TARGET_JSON,
    icon: "xml",
  },
  {
    id: "json-xml",
    label: "JSON to XML",
    description: "Shipment JSON mapped into an XML ShipmentEvent document.",
    sourceFormat: "json",
    targetFormat: "xml",
    source: SAMPLE_SOURCE_JSON,
    target: SAMPLE_TARGET_XML,
    icon: "xml",
  },
  {
    id: "edi-214",
    label: "EDI 214",
    description: "Inbound 214 status update canonicalized before mapping.",
    sourceFormat: "edi_214",
    targetFormat: "json",
    source: SAMPLE_EDI_214,
    target: SAMPLE_TARGET_JSON,
    icon: "edi",
  },
  {
    id: "edi-856",
    label: "EDI 856",
    description: "Inbound 856 ASN canonicalized before mapping.",
    sourceFormat: "edi_856",
    targetFormat: "json",
    source: SAMPLE_EDI_856,
    target: SAMPLE_TARGET_JSON,
    icon: "edi",
  },
]

function MappingWorkbench() {
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("json")
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("json")
  const [sourceInput, setSourceInput] = useState(SAMPLE_SOURCE_JSON)
  const [targetInput, setTargetInput] = useState(SAMPLE_TARGET_JSON)
  const [sourceData, setSourceData] = useState<unknown>(null)
  const [sourceSchema, setSourceSchema] = useState<SchemaNode | null>(null)
  const [targetSchema, setTargetSchema] = useState<SchemaNode | null>(null)
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([])
  const [rules, setRules] = useState<MappingRule[]>([])
  const [advancedJsonata, setAdvancedJsonata] = useState("")
  const [transformResult, setTransformResult] = useState<TransformResponse | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([])
  const [providerErrors, setProviderErrors] = useState<string[]>([])
  const [usedAi, setUsedAi] = useState(false)
  const [autoMapMode, setAutoMapMode] = useState<AutoMapMode>("local")
  const [autoMapStatus, setAutoMapStatus] = useState<AutoMapStatus>("idle")
  const [aiMappingAvailable, setAiMappingAvailable] = useState(false)
  const [templates, setTemplates] = useState<MappingTemplate[]>([])
  const [activeTemplate, setActiveTemplate] = useState<MappingTemplate | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("Shipment status map")
  const [templateDescription, setTemplateDescription] = useState("")
  const [activeScenarioId, setActiveScenarioId] = useState("json-json")
  const [issue, setIssue] = useState<FrontendIssue | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const readyForMapping = Boolean(sourceSchema && targetSchema)
  const readyForTransform = Boolean(sourceData && rules.length > 0)
  const readyForTemplateSave = Boolean(sourceSchema && targetSchema && rules.length > 0)
  const statusText = useMemo(() => {
    if (busyAction) return busyAction
    if (validationErrors.length > 0) return `${validationErrors.length} validation issue(s)`
    if (transformResult) return "Transformation complete"
    if (rules.length > 0) return `${rules.length} editable rule(s)`
    return "Waiting for samples"
  }, [busyAction, rules.length, transformResult, validationErrors.length])
  const autoMapStatusText = useMemo(() => {
    if (autoMapStatus === "local") return "Local suggestions"
    if (autoMapStatus === "ai-used") return "AI used"
    if (autoMapStatus === "ai-fallback") return "AI failed, local used"
    if (autoMapStatus === "ai-unavailable") return "AI unavailable, local used"
    return autoMapMode === "ai" ? "AI-assisted mode" : "Local mode"
  }, [autoMapMode, autoMapStatus])

  useEffect(() => {
    void refreshTemplates()
    void refreshMappingCapabilities()
  }, [])

  return (
    <main className="workbench-shell">
      <header className="workbench-header">
        <div>
          <p className="eyebrow">Auto Mapping POC</p>
          <h1>Mapping Workbench</h1>
        </div>
        <div className="run-bar">
          <span>{statusText}</span>
          <Button type="button" variant="outline" onClick={() => void parseAndInfer()} disabled={Boolean(busyAction)}>
            {busyAction === "Parsing samples" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Parse
          </Button>
          <div className="auto-map-mode" aria-label="Auto map mode">
            <button
              type="button"
              className={autoMapMode === "local" ? "active" : ""}
              onClick={() => setAutoMapMode("local")}
              disabled={Boolean(busyAction)}
            >
              Local
            </button>
            <button
              type="button"
              className={autoMapMode === "ai" ? "active" : ""}
              onClick={() => setAutoMapMode("ai")}
              disabled={Boolean(busyAction) || !aiMappingAvailable}
              title={aiMappingAvailable ? "Use OpenRouter-assisted suggestions" : "AI unavailable"}
            >
              AI-assisted
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void autoMap()}
            disabled={!readyForMapping || Boolean(busyAction)}
          >
            {busyAction === "Generating mappings" ? <Loader2 className="animate-spin" /> : <Bot />}
            Auto map
          </Button>
          <Button
            type="button"
            onClick={() => void runTransform()}
            disabled={!readyForTransform || Boolean(busyAction)}
          >
            {busyAction === "Running transformation" ? <Loader2 className="animate-spin" /> : <Play />}
            Run
          </Button>
        </div>
      </header>

      {issue ? (
        <div className="issue-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>{issue.title}</strong>
            <span>{issue.detail}</span>
          </div>
        </div>
      ) : null}

      {busyAction ? (
        <div className="busy-banner" role="status" aria-live="polite">
          <Loader2 className="animate-spin" size={16} />
          <span>{busyAction}</span>
        </div>
      ) : null}

      <DemoScenarioPanel
        scenarios={demoScenarios}
        activeScenarioId={activeScenarioId}
        busyAction={busyAction}
        onSelect={loadScenario}
      />

      <div className="input-grid">
        <SourceInputPanel
          value={sourceInput}
          format={sourceFormat}
          onValueChange={setSourceInput}
          onFormatChange={setSourceFormat}
        />
        <TargetInputPanel
          value={targetInput}
          format={targetFormat}
          onValueChange={setTargetInput}
          onFormatChange={(format) => {
            setTargetFormat(format)
            setTargetInput(format === "xml" ? SAMPLE_TARGET_XML : SAMPLE_TARGET_JSON)
          }}
        />
      </div>

      <div className="schema-grid">
        <SchemaViewer title="Source fields" schema={sourceSchema} />
        <SchemaViewer title="Target fields" schema={targetSchema} />
        <MappingSuggestionPanel
          suggestions={suggestions}
          usedAi={usedAi}
          statusText={autoMapStatusText}
          providerErrors={providerErrors}
        />
      </div>

      <div className="editor-grid">
        <VisualMappingEditor rules={rules} onRulesChange={syncRules} />
        <JsonataEditor value={advancedJsonata} onChange={setAdvancedJsonata} />
      </div>

      <div className="result-grid">
        <OutputPreview result={transformResult} />
        <ValidationPanel errors={validationErrors} />
        <TemplateVersionPanel
          templates={templates}
          activeTemplate={activeTemplate}
          selectedTemplateId={selectedTemplateId}
          templateName={templateName}
          templateDescription={templateDescription}
          canSave={readyForTemplateSave}
          busyAction={busyAction}
          onTemplateNameChange={setTemplateName}
          onTemplateDescriptionChange={setTemplateDescription}
          onSelectedTemplateChange={(templateId) => {
            setSelectedTemplateId(templateId)
            const selected = templates.find((template) => template.template_id === templateId) ?? null
            setActiveTemplate(selected)
            if (selected) {
              setTemplateName(selected.name)
              setTemplateDescription(selected.description)
              if (selected.is_seeded) {
                void loadTemplate(selected.template_id)
              }
            }
          }}
          onSaveTemplate={() => void saveTemplate()}
          onCreateVersion={() => void saveTemplateVersion()}
          onLoadTemplate={(templateId, version) => void loadTemplate(templateId, version)}
          onRefreshTemplates={() => void refreshTemplates()}
        />
      </div>
    </main>
  )

  async function parseAndInfer() {
    setBusyAction("Parsing samples")
    setIssue(null)
    try {
      const parsedSource = await Effect.runPromise(parseEffect(sourceFormat, sourceInput))
      const targetParseFormat = targetFormat === "xml" ? "xml" : "json"
      const parsedTarget = await Effect.runPromise(parseEffect(targetParseFormat, targetInput))
      const inferredSource = await Effect.runPromise(inferSchemaEffect(parsedSource.canonical))
      const inferredTarget = await Effect.runPromise(inferSchemaEffect(parsedTarget.canonical))

      setSourceData(parsedSource.canonical)
      setSourceSchema(inferredSource.schema)
      setTargetSchema(inferredTarget.schema)
      setTransformResult(null)
      setValidationErrors([])
      setAutoMapStatus("idle")
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function autoMap() {
    if (!sourceSchema || !targetSchema) return
    setBusyAction("Generating mappings")
    setIssue(null)
    try {
      const useAi = autoMapMode === "ai"
      const response = await Effect.runPromise(suggestMappingsEffect(sourceSchema, targetSchema, useAi))
      setSuggestions(response.suggestions)
      setProviderErrors(response.provider_errors)
      setUsedAi(response.used_ai)
      setAutoMapStatus(statusForAutoMapResult(useAi, response.used_ai, response.provider_errors))
      syncRules(response.suggestions.map(suggestionToRule))
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function runTransform() {
    if (!sourceData) return
    setBusyAction("Running transformation")
    setIssue(null)
    try {
      const validationSchema = targetFormat === "json" ? targetSchema : null
      const response = await Effect.runPromise(
        transformEffect(sourceData, rules, targetFormat, validationSchema),
      )
      setTransformResult(response)
      const validation = await Effect.runPromise(
        validateEffect(sourceData, response.output, rules, validationSchema),
      )
      setValidationErrors([...response.validation_errors, ...validation.errors])
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function refreshTemplates() {
    setBusyAction((current) => current ?? "Loading templates")
    try {
      const response = await Effect.runPromise(listTemplatesEffect())
      setTemplates(response.templates)
      if (selectedTemplateId) {
        const selected = response.templates.find((template) => template.template_id === selectedTemplateId) ?? null
        setActiveTemplate(selected)
      }
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction((current) => (current === "Loading templates" ? null : current))
    }
  }

  async function refreshMappingCapabilities() {
    try {
      const capabilities = await Effect.runPromise(getMappingCapabilitiesEffect())
      setAiMappingAvailable(capabilities.ai_mapping_available)
      if (!capabilities.ai_mapping_available) {
        setAutoMapMode("local")
      }
    } catch {
      setAiMappingAvailable(false)
      setAutoMapMode("local")
    }
  }

  async function saveTemplate() {
    if (!sourceSchema || !targetSchema || rules.length === 0) return
    setBusyAction("Saving template")
    setIssue(null)
    try {
      const template = await Effect.runPromise(
        createTemplateEffect({
          name: templateName.trim(),
          description: templateDescription.trim(),
          source_format: sourceFormat,
          target_format: targetFormat,
          source_schema_snapshot: sourceSchema,
          target_schema_snapshot: targetSchema,
          mapping_spec: currentMappingSpec(),
          validation_rules: validationErrors,
        }),
      )
      await applySavedTemplate(template)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function saveTemplateVersion() {
    if (!sourceSchema || !targetSchema || rules.length === 0 || !selectedTemplateId) return
    setBusyAction("Saving version")
    setIssue(null)
    try {
      const template = await Effect.runPromise(
        createTemplateVersionEffect(selectedTemplateId, {
          source_format: sourceFormat,
          target_format: targetFormat,
          source_schema_snapshot: sourceSchema,
          target_schema_snapshot: targetSchema,
          mapping_spec: currentMappingSpec(),
          validation_rules: validationErrors,
        }),
      )
      await applySavedTemplate(template)
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function loadTemplate(templateId: string, versionNumber?: number) {
    setBusyAction("Loading template")
    setIssue(null)
    try {
      const template = await Effect.runPromise(getTemplateEffect(templateId))
      const version =
        template.versions.find((item) => item.version === (versionNumber ?? template.active_version)) ??
        template.versions.at(-1)
      if (!version) return

      setActiveTemplate(template)
      setSelectedTemplateId(template.template_id)
      setTemplateName(template.name)
      setTemplateDescription(template.description)
      setSourceFormat(version.source_format)
      setTargetFormat(version.target_format)
      if (version.sample_source_content) {
        setSourceInput(version.sample_source_content)
        setSourceData(parseJsonSample(version.sample_source_content))
      } else {
        setSourceData(null)
      }
      if (version.sample_target_content) {
        setTargetInput(version.sample_target_content)
      }
      setSourceSchema(version.source_schema_snapshot ?? null)
      setTargetSchema(version.target_schema_snapshot ?? null)
      syncRules(version.mapping_spec.rules)
      setAdvancedJsonata(version.mapping_spec.full_jsonata_expression ?? "")
      setValidationErrors(version.validation_rules)
      setTransformResult(null)
      setSuggestions([])
      setProviderErrors([])
      setUsedAi(false)
      setAutoMapStatus("idle")
    } catch (error) {
      setIssue(issueFromUnknown(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function applySavedTemplate(template: MappingTemplate) {
    setActiveTemplate(template)
    setSelectedTemplateId(template.template_id)
    setTemplateName(template.name)
    setTemplateDescription(template.description)
    const response = await Effect.runPromise(listTemplatesEffect())
    setTemplates(response.templates)
  }

  function syncRules(nextRules: MappingRule[]) {
    setRules(nextRules)
    setAdvancedJsonata(JSON.stringify(nextRules.map((rule) => rule.jsonata ?? ""), null, 2))
  }

  function currentMappingSpec() {
    return {
      engine: "deterministic_rules",
      rules,
      full_jsonata_expression: advancedJsonata.trim() || null,
    }
  }

  function loadScenario(scenario: DemoScenario) {
    setActiveScenarioId(scenario.id)
    setSourceFormat(scenario.sourceFormat)
    setTargetFormat(scenario.targetFormat)
    setSourceInput(scenario.source)
    setTargetInput(scenario.target)
    setSourceData(null)
    setSourceSchema(null)
    setTargetSchema(null)
    setSuggestions([])
    setRules([])
    setAdvancedJsonata("")
    setTransformResult(null)
    setValidationErrors([])
    setProviderErrors([])
    setUsedAi(false)
    setAutoMapStatus("idle")
    setIssue(null)
    setTemplateName(`${scenario.label} map`)
    setTemplateDescription(scenario.description)
  }
}

function parseJsonSample(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function statusForAutoMapResult(
  requestedAi: boolean,
  usedAi: boolean,
  providerErrors: string[],
): AutoMapStatus {
  if (!requestedAi) return "local"
  if (usedAi) return "ai-used"
  return providerErrors.length > 0 ? "ai-fallback" : "ai-unavailable"
}

function suggestionToRule(suggestion: MappingSuggestion): MappingRule {
  return {
    id: suggestion.id,
    type: suggestion.type,
    source_path: suggestion.source_path,
    target_path: targetPathForRuntime(suggestion.target_path),
    required: suggestion.required,
    confidence: suggestion.confidence,
    jsonata: suggestion.jsonata,
  }
}

function targetPathForRuntime(path: string) {
  return path
    .replace("$.ShipmentEvent.", "$.")
    .replace("$.ShipmentEvent", "$")
    .replace("$.tracking.number", "$.tracking.number")
}
