# Current Architecture

This project is a local script-first mapping workbench. The current product foundation is a FastAPI backend that owns mapping semantics and a TanStack Start frontend that calls the backend directly for schema, mapping, transform, validation, diff, and template operations.

## Runtime Shape

- The backend runs locally as FastAPI and exposes product operations under `/api`.
- The frontend runs locally as a TanStack Start workbench and uses `VITE_API_BASE_URL` to call FastAPI directly.
- Schema artifacts and mapping templates are persisted in a local SQLite database, defaulting to `backend/data/templates.sqlite3`.
- OpenRouter is optional design-time assistance for field hints and script drafts; it is not part of transform execution.

## Script-First Mapping Contract

The only supported executable mapping artifact in the current architecture is a JavaScript transform stored in `mapping_spec.engine: "script_js"`:

```js
function transform(source, helpers) {
  return {
    // mapped output
  }
}
```

The backend executes this function in a sandboxed PyMiniRacer runtime with helper functions for common mapping operations. The script receives canonical source data and returns JSON-shaped output. The backend then validates the returned object and serializes it as JSON or XML based on the requested output format.

## Backend Ownership

FastAPI routes are API boundaries, not the owner of mapping business rules. Core backend modules own parsing, schema inference, rule-based suggestions, optional OpenRouter generation, script runtime execution, validation, output writing, diffing, and SQLite repositories.

Full transform execution is orchestrated by `MappingRunService`, which normalizes missing mapping specs, executes the script runtime, validates the output, serializes JSON or XML output, and returns the stable `/api/transform` response contract.

## Validation And Diff Policy

Mapping correctness is output-format specific:

- JSON outputs are JSON-shaped Python values. When a target schema is available, validation checks required target leaf fields and scalar types. `/api/transform/diff` supports path-level JSON comparison for missing, extra, and changed values.
- XML outputs are produced by serializing the script-returned JSON-shaped value with the requested root element. Validation confirms the script run can produce serializable output; JSON-shaped target-schema required-field and type checks are intentionally not applied to XML output.
- XML target samples are parsed into canonical JSON for schema inference and field hints, but the current runtime does not guarantee XML canonical structural parity against an XML sample.
- XML diff parity is intentionally unavailable in the current workbench. The API returns an unsupported diff response for `output_format: "xml"`, and the frontend presents this as a limitation rather than a failed mapping.
- EDI inputs are source formats only in the current schema artifact lifecycle. They can feed script transforms after canonical parsing, but target correctness still follows the selected JSON or XML output policy.

## Persistence Lifecycle

The supported lifecycle is one local SQLite database path. Schema artifacts store original content, canonical samples, inferred schemas, metadata, and soft-delete state. Templates store versioned script mapping specs, schema links, schema snapshots, validation rules, and sample source/target content.

This keeps the POC easy to run locally while preserving a future migration seam: workspace or SaaS scoping can be introduced later around the repository layer and API filters without changing the script mapping contract.

## Historical And Superseded Paths

Older documentation may mention visual rules, JSONata metadata, deterministic rule execution, native graph templates, or a future Java runtime. Those paths are historical or superseded for the current implementation. They should not be treated as active executable mapping contracts in this phase.

The current path is script-first: schema selection, field hints, script draft generation, JavaScript authoring, sandboxed execution, validation, diffing, and versioned script templates.
