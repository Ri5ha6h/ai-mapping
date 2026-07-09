# Native Complex Mapping Runtime - Backend Tracker

This tracker covers the backend-first work needed to handle real complex mappings like the legacy `samples/json2json` and `samples/xml2json` examples without executing old platform `logic*.json` files or embedded Groovy-like code.

## Working Rules

- Preserve existing `deterministic_rules` behavior and templates.
- Introduce complex mapping capability through a versioned native spec.
- Use legacy logic JSON files as capability references only.
- Use sample source/output pairs as golden acceptance tests.
- Keep XML format-neutral by parsing XML into canonical JSON and using canonical JSON paths.
- Keep AI/design-time suggestions separate from deterministic production execution.

## Missing In The Previous Setup

- The rule model only supported direct fields, constants, concat, date formatting, equality conditions, and one basic loop.
- There was no native artifact for intermediate state, scoped context, reusable calculations, lookup tables, generated arrays, or target-tree construction.
- Complex `CALC:*` behavior from the legacy samples had no safe equivalent.
- Loops could not filter, derive extra records, or build arrays from intermediate values.
- Validation did not understand graph shape, lookup references, expression placement, or complex runtime dependencies.
- Templates had an engine field, but no richer versioned spec contract.

## Target Architecture

```text
MappingSpec
  -> engine: deterministic_rules | native_graph
  -> spec_version
  -> rules                      # existing engine
  -> native_graph               # new engine

NativeGraphSpec
  -> spec_version
  -> lookup_tables
  -> nodes

NativeGraphNode
  -> assign                     # field, constant, default, JSONata value expression
  -> loop                       # scoped source array mapping
  -> compute                    # named deterministic operations for complex arrays
  -> transforms                 # string/date/lookup/default normalizers
```

## Phase 1 - Gap Analysis And Spec Design

Status: Complete - initial implementation ready for review

### Tasks

- [x] Compare `samples/json2json/logicjson2json.json` with current runtime capability.
- [x] Compare `samples/xml2json/logicxml2json.json` with current runtime capability.
- [x] Document missing concepts: scoped variables, `CALC:*`, lookup tables, filtered loops, generated arrays, reusable transforms, and golden output checks.
- [x] Choose native graph spec over direct legacy logic execution.
- [x] Choose hybrid execution: declarative graph plus JSONata only inside value expressions.

### Checkpoint

- [x] `json2json` sample requirements can be represented without executing legacy code.

## Phase 2 - Backend Models And Validation

Status: Complete - initial implementation ready for review

### Tasks

- [x] Add `MappingSpec.spec_version`.
- [x] Add `NativeGraphSpec`.
- [x] Add `NativeGraphNode`.
- [x] Add transform definitions for defaulting, regex replacement, first token extraction, date formatting, and lookups.
- [x] Add `/api/transform` dispatch for `engine: "native_graph"`.
- [x] Add `/api/validate` dispatch for `engine: "native_graph"`.
- [x] Preserve legacy `rules` request compatibility.
- [x] Validate duplicate node IDs, unsupported operations, bad expression placement, unknown lookup tables, missing loop config, and missing source paths where statically checkable.

### Checkpoint

- [x] Invalid native specs return structured validation errors.

## Phase 3 - Native Graph Runtime

Status: Complete for `json2json` golden path - ready for review

### Tasks

- [x] Implement ordered native graph execution.
- [x] Implement scoped loop execution.
- [x] Implement target-path assignment.
- [x] Implement JSONata value expression evaluation for assignment nodes.
- [x] Implement transform pipeline.
- [x] Implement lookup table transform.
- [x] Implement deterministic computed array operations needed by the Hapag `json2json` sample:
  - [x] container number cleanup
  - [x] container type extraction
  - [x] delivery, pickup, port of discharge, and port of loading stop construction
  - [x] event code derivation
  - [x] event qualifier normalization
  - [x] event timestamp seconds normalization
  - [x] vessel name cleanup
  - [x] derived final availability event
- [x] Add exact golden test for `samples/json2json/source.json` to `samples/json2json/output.json`.

### Checkpoint

- [x] Backend test transforms `samples/json2json/source.json` into exact `samples/json2json/output.json`.

## Phase 4 - Template/API Integration

Status: Complete for backend API and persistence - ready for review

### Tasks

- [x] Allow `/api/transform` to accept a native graph `mapping_spec`.
- [x] Allow `/api/validate` to accept a native graph `mapping_spec`.
- [x] Keep existing deterministic templates compatible with `MappingSpec`.
- [x] Add template repository tests that create and reload a native graph template.
- [x] Add a seeded or fixture-backed native graph template for the `json2json` sample.
- [x] Add frontend type updates for authoring/displaying native graph specs.
- [x] Add frontend type coverage for persisted native graph specs.

### Checkpoint

- [x] Saved native graph templates can be loaded and executed through existing backend flows.

## Phase 5 - XML Canonical Path Support

Status: Complete - ready for review

### Tasks

- [x] Represent the `xml2json` mapping using canonical JSON paths from the XML parser.
- [x] Add lookup tables needed by the XML sample.
- [x] Add reusable helper operation equivalents for address-line splitting, unit conversion, country code conversion, and conditional node inclusion.
- [x] Add filtered loop/map support for qualifier-based XML arrays.
- [x] Add exact golden test for `samples/xml2json/source.xml` to `samples/xml2json/output.json`.

### Checkpoint

- [x] Backend test transforms `samples/xml2json/source.xml` into exact `samples/xml2json/output.json`.

## Phase 6 - Tooling And Future UI Readiness

Status: Complete - ready for review

### Tasks

- [x] Add execution trace output for node inputs, outputs, skipped nodes, and errors.
- [x] Add analyzer tooling that reads legacy `logic*.json` and reports required native capabilities without executing old code.
- [x] Document UI requirements for graph editing, lookup editing, expression editing, run traces, and golden sample verification.

### Checkpoint

- [x] Backend is ready for a later frontend authoring roadmap.

### UI Follow-Up Requirements

- Graph editing should show native graph nodes as ordered, inspectable operations with stable node IDs.
- Lookup editing should expose table name, key/value entries, defaults, and missing-key behavior.
- Expression editing should be limited to assignment-node value expressions and validate the supported JSONata profile before save.
- Run traces should show node status, target path, and error message for failed nodes.
- Golden sample verification should compare source, expected target, actual output, and path-level diffs.

## Test Plan

- [x] Existing deterministic transform tests must keep passing.
- [x] Native graph golden test must exactly match `samples/json2json/output.json`.
- [x] Native graph validation must report unknown lookup tables.
- [x] Native graph template persistence tests must cover create, reload, and execute.
- [x] XML canonical-path golden test must exactly match `samples/xml2json/output.json`.

## Assumptions

- Legacy `logic*.json` files are not executed directly.
- Native graph is the long-term mapping artifact.
- JSONata is allowed only inside value assignment expressions.
- Canonical JSON paths are the selector model for all parsed source formats.
- Frontend authoring is deferred until backend execution and persistence are stable.
