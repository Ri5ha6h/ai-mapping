import { useEffect, useMemo, useState } from "react"
import { Effect } from "effect"

import {
  generateScriptDraftEffect,
  getMappingCapabilitiesEffect,
  suggestMappingsEffect,
} from "@/lib/effect/api_effects"
import type { MappingSpec, MappingSuggestion } from "@/types/mapping"
import type { CurrentMappingInputs } from "./useMappingSetupController"

export type AutoMapMode = "local" | "ai"
export type AutoMapStatus = "idle" | "local" | "ai-used" | "ai-unavailable" | "ai-fallback"

export const DEFAULT_SCRIPT = `function transform(source, helpers) {
  // source is the parsed input object. XML and EDI inputs arrive as canonical JSON.
  // helpers includes get, default, clean, regexReplace, parseNumber, formatDate,
  // lookup, countryCode, and omitEmpty.
  // Example: helpers.get(source, "$.customer.name", "")

  return {
    // Build the target JSON here.
  };
}`

export type ScriptAuthoringControllerArgs = {
  currentMappingInputs: () => Promise<CurrentMappingInputs>
  clearRunResults: () => void
}

export function useScriptAuthoringController({
  currentMappingInputs,
  clearRunResults,
}: ScriptAuthoringControllerArgs) {
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([])
  const [script, setScript] = useState(DEFAULT_SCRIPT)
  const [draftExplanation, setDraftExplanation] = useState("")
  const [unresolvedTargetPaths, setUnresolvedTargetPaths] = useState<string[]>([])
  const [providerErrors, setProviderErrors] = useState<string[]>([])
  const [usedAi, setUsedAi] = useState(false)
  const [autoMapMode, setAutoMapMode] = useState<AutoMapMode>("local")
  const [autoMapStatus, setAutoMapStatus] = useState<AutoMapStatus>("idle")
  const [aiMappingAvailable, setAiMappingAvailable] = useState(false)

  const mappingSpec = useMemo<MappingSpec>(
    () => ({ engine: "script_js", script_version: 1, script }),
    [script]
  )

  const autoMapStatusText = useMemo(() => {
    if (autoMapStatus === "local") return "Local field hints"
    if (autoMapStatus === "ai-used") return "AI used"
    if (autoMapStatus === "ai-fallback") return "AI failed, local used"
    if (autoMapStatus === "ai-unavailable") return "AI unavailable, local used"
    return autoMapMode === "ai" ? "AI-assisted mode" : "Local mode"
  }, [autoMapMode, autoMapStatus])

  useEffect(() => {
    Effect.runPromise(getMappingCapabilitiesEffect()).then(
      (capabilities) => setAiMappingAvailable(capabilities.ai_mapping_available),
      () => setAiMappingAvailable(false)
    )
  }, [])

  async function autoMap() {
    const parsed = await currentMappingInputs()
    const useAi = autoMapMode === "ai"
    const response = await Effect.runPromise(
      suggestMappingsEffect(parsed.sourceSchema, parsed.targetSchema, useAi)
    )
    setSuggestions(response.suggestions)
    setUsedAi(response.used_ai)
    setProviderErrors(response.provider_errors)
    setAutoMapStatus(statusForAutoMapResult(useAi, response.used_ai, response.provider_errors))
  }

  async function generateScript() {
    const parsed = await currentMappingInputs()
    const response = await Effect.runPromise(
      generateScriptDraftEffect(
        parsed.sourceData,
        parsed.targetData,
        parsed.sourceSchema,
        parsed.targetSchema,
        parsed.fieldValidationRules,
        autoMapMode === "ai"
      )
    )
    setScript(response.mapping_spec.script)
    setDraftExplanation(response.explanation)
    setUnresolvedTargetPaths(response.unresolved_target_paths)
    setProviderErrors(response.provider_errors)
    setUsedAi(response.used_ai)
    clearRunResults()
    setAutoMapStatus("idle")
  }

  function updateScript(value: string) {
    setScript(value)
    clearRunResults()
    setAutoMapStatus("idle")
  }

  function clearMappingSuggestions() {
    setSuggestions([])
    setProviderErrors([])
    setUsedAi(false)
  }

  function resetAuthoring() {
    setSuggestions([])
    setScript(DEFAULT_SCRIPT)
    setDraftExplanation("")
    setUnresolvedTargetPaths([])
    setProviderErrors([])
    setUsedAi(false)
    setAutoMapStatus("idle")
  }

  return {
    suggestions,
    script,
    draftExplanation,
    unresolvedTargetPaths,
    providerErrors,
    usedAi,
    autoMapMode,
    autoMapStatus,
    aiMappingAvailable,
    mappingSpec,
    autoMapStatusText,
    setScript: updateScript,
    setScriptRaw: setScript,
    setDraftExplanation,
    setUnresolvedTargetPaths,
    setProviderErrors,
    setUsedAi,
    setAutoMapMode,
    setAutoMapStatus,
    autoMap,
    generateScript,
    clearMappingSuggestions,
    resetAuthoring,
  }
}

function statusForAutoMapResult(
  requestedAi: boolean,
  usedAi: boolean,
  providerErrors: string[]
): AutoMapStatus {
  if (!requestedAi) return "local"
  if (usedAi) return "ai-used"
  return providerErrors.length > 0 ? "ai-fallback" : "ai-unavailable"
}

export type ScriptAuthoringController = ReturnType<typeof useScriptAuthoringController>
