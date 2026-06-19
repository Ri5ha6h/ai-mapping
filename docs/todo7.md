# todo7.md - Simple Script-Based Mapping

Current architecture reference: see `docs/architecture-current.md`. For the current phase, `mapping_spec.engine: "script_js"` and its `script` string are the only supported executable mapping artifact. Mentions of visual rules, JSONata, native graph execution, or native mapping DSLs in older docs are historical unless explicitly reintroduced by a future architecture update.

## Working Rules

- Keep the user-facing mapping model to one concept: a JavaScript transform function.
- Do not expose native graph, JSONata, rule nodes, or mapping DSL language in normal UI.
- Keep parsing, canonical JSON, schema inference, validation, templates, versions, output preview, and diffing.
- Keep AI as design-time assistance only; script execution remains deterministic.
- Execute scripts synchronously in a sandbox with no imports, filesystem, process, or network access.

## Scope Guardrails

- This is a clean POC break; old deterministic rule, JSONata, and native graph templates are not migrated.
- Use `mapping_spec.engine: "script_js"` as the only mapping engine.
- Store one script string shaped as `function transform(source, helpers) { ... }`.
- XML continues to parse to canonical JSON before script execution.
- The future Java product can keep the stored JavaScript contract and replace the Python runtime.

## Target Architecture

```text
Source Input
  -> Format Parser
  -> Canonical JSON
  -> Schema Inference
  -> Script Hint / Script Draft Generation
  -> JavaScript Transform Function Editor
  -> Sandboxed Script Runtime
  -> Validation Engine
  -> JSON or XML Output
  -> Target Diff
  -> Save Versioned Script Template
```

## Backend Checklist

- [x] Add `mini-racer` as the Python POC JavaScript sandbox runtime.
- [x] Replace public mapping models with `mapping_spec.engine: "script_js"` and `script`.
- [x] Remove native graph API models, runtime, validation, generator, and seeded templates.
- [x] Remove deterministic rule execution and JSONata runtime as transform engines.
- [x] Add sandboxed script execution with timeout and JSON-serializable output.
- [x] Block imports, process, network, filesystem-style globals, and async result handling.
- [x] Add helper functions for get/default/clean/regexReplace/parseNumber/formatDate/lookup/countryCode/omitEmpty.
- [x] Update `/api/transform` to execute scripts only.
- [x] Update `/api/validate` to validate script presence and output schema.
- [x] Add `/api/mappings/script/draft` deterministic fallback generation.
- [x] Keep `/api/transform/diff`.
- [x] Replace seeded examples with script templates.
- [x] Add exact script golden coverage for `samples/json2json`.
- [x] Add exact script golden coverage for `samples/xml2json`.

## Frontend Checklist

- [x] Replace mapping types with script-only mapping spec types.
- [x] Replace visual rules, JSONata editor, and native graph editor with Script Workbench.
- [x] Add transform function editor.
- [x] Add Generate script action.
- [x] Add Run script action.
- [x] Display draft explanation and unresolved target paths.
- [x] Display script execution output, validation errors, trace status, and target diff.
- [x] Save and reload script templates with versions.
- [x] Keep schema selection, schema library, template picker, and output panels.
- [x] Remove user-facing native graph, JSONata, node, and rule wording from the mapping flow.

## Test Checklist

- [x] Script runtime executes simple field mapping.
- [x] Script runtime handles arrays, cleanup, date formatting, number parsing, lookups, country codes, and empty suppression.
- [x] Script sandbox rejects async results and runaway scripts.
- [x] Script errors return structured validation/execution errors.
- [x] Seeded script templates are available and idempotent.
- [x] `example-script-json2json` exactly matches the JSON2JSON golden output.
- [x] `example-script-xml2json` exactly matches the XML2JSON golden output.
- [x] Template persistence stores and executes script mappings.
- [x] Frontend typecheck and build pass.

## Review Notes

- The complex sample scripts currently prioritize exact golden acceptance and simple user comprehension.
- A follow-up can improve generated sample scripts from literal-heavy output builders into more source-derived JavaScript while keeping the same script contract.
- AI generation remains optional and can be enhanced without changing runtime execution semantics.
