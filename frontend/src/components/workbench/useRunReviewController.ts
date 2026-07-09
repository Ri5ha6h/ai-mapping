import { useMemo, useState } from "react"
import { Effect } from "effect"

import {
  diffOutputEffect,
  transformEffect,
  validateEffect,
} from "@/lib/effect/api_effects"
import type { FrontendIssue } from "@/lib/effect/errors"
import type {
  MappingSpec,
  OutputDiffItem,
  OutputFormat,
  TransformResponse,
} from "@/types/mapping"
import type { ValidationErrorItem } from "@/types/validation"
import type { CurrentMappingInputs } from "./useMappingSetupController"

export type RunReviewControllerArgs = {
  currentMappingInputs: () => Promise<CurrentMappingInputs>
  mappingSpec: MappingSpec
  outputFormat: OutputFormat
  readyForMapping: boolean
  withBusy: (label: string, action: () => Promise<void>) => Promise<void>
  setIssue?: (issue: FrontendIssue | null) => void
}

export function useRunReviewController({
  currentMappingInputs,
  mappingSpec,
  outputFormat,
  readyForMapping,
  withBusy,
}: RunReviewControllerArgs) {
  const [transformResult, setTransformResult] =
    useState<TransformResponse | null>(null)
  const [validationErrors, setValidationErrors] = useState<
    ValidationErrorItem[]
  >([])
  const [outputDiff, setOutputDiff] = useState<OutputDiffItem[]>([])

  const readyForTransform =
    readyForMapping && mappingSpec.script.trim().length > 0
  const runLogs = transformResult?.logs ?? []
  const trace = transformResult?.trace ?? []

  const reviewStatusText = useMemo(() => {
    if (validationErrors.length > 0)
      return `${validationErrors.length} validation issue(s)`
    if (outputDiff.length > 0)
      return `${outputDiff.length} output difference(s)`
    if (transformResult) return "Script run complete"
    if (readyForTransform) return "Ready to run script"
    return "Waiting for schemas"
  }, [
    outputDiff.length,
    readyForTransform,
    transformResult,
    validationErrors.length,
  ])

  function clearRunResults() {
    setTransformResult(null)
    setValidationErrors([])
    setOutputDiff([])
  }

  async function runTransform() {
    if (!readyForTransform) return
    await withBusy("Running script", async () => {
      const parsed = await currentMappingInputs()
      const validationSchema =
        outputFormat === "json" ? parsed.targetSchema : null
      const response = await Effect.runPromise(
        transformEffect(
          parsed.sourceData,
          mappingSpec,
          outputFormat,
          validationSchema,
          parsed.fieldValidationRules
        )
      )
      setTransformResult(response)

      const validation = await Effect.runPromise(
        validateEffect(
          parsed.sourceData,
          response.output,
          mappingSpec,
          validationSchema,
          outputFormat,
          parsed.fieldValidationRules
        )
      )
      setValidationErrors([...response.validation_errors, ...validation.errors])

      if (outputFormat === "json") {
        const diff = await Effect.runPromise(
          diffOutputEffect(parsed.targetData, response.output, outputFormat)
        )
        setOutputDiff(diff.diffs)
      } else {
        setOutputDiff([])
      }
    })
  }

  function restoreValidationErrors(errors: ValidationErrorItem[]) {
    setValidationErrors(errors)
    setTransformResult(null)
    setOutputDiff([])
  }

  return {
    transformResult,
    validationErrors,
    outputDiff,
    runLogs,
    trace,
    readyForTransform,
    reviewStatusText,
    setTransformResult,
    setValidationErrors,
    setOutputDiff,
    clearRunResults,
    runTransform,
    restoreValidationErrors,
  }
}

export type RunReviewController = ReturnType<typeof useRunReviewController>
