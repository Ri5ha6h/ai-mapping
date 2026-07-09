# todo6.md - Generic Native Graph Authoring And Generation

## Working Rules

- Keep `deterministic_rules` behavior and saved templates backward compatible.
- Keep deprecated compute operations available for existing native graph templates.
- Do not execute legacy `logic*.json` or embedded Groovy-like code.
- Use canonical JSON paths for JSON, XML, EDI, and future parsed formats.
- Treat AI as optional design-time assistance only; production execution stays deterministic.

## Scope Guardrails

- First authoring experience is a structured JSON editor, not a visual node builder.
- Generic graph primitives must be reusable outside the two bundled samples.
- Sample-specific compute nodes remain compatibility examples only.
- Heuristic draft generation must work without configured AI credentials.
- Frontend must preserve the deterministic visual rule editor.

## Target Architecture

- Backend accepts versioned native graph specs with generic node types and transform nodes.
- Runtime executes declarative graph/template nodes against scoped context.
- Draft generation returns a partial native graph spec and unresolved target paths.
- Diffing is backend-owned and reports path-level missing, extra, and changed values.
- Frontend supports generate, edit, validate/apply, run, compare, save, and reload for native graph specs.

## Backend Checklist

- [x] Expand native graph node model beyond `assign`, `loop`, and `compute`.
- [x] Add generic node types: `template`, `object`, `array`, `map`, `filter`, `reduce`, `conditional`, `lookup`, `switch`, `append`, `merge`, `group_by`, and `sort`.
- [x] Add scoped context support for root, current item, parent item, index, and named variables.
- [x] Add reusable transforms for regex cleanup, defaulting, split/join, date formatting, number conversion, unit-style multiply/divide, rounding, country-code conversion, and empty suppression.
- [x] Keep `hapag_stops`, `hapag_events`, and `otm_booking_request` available as deprecated compatibility compute operations.
- [x] Add backend path-level output diff utility and `/api/transform/diff`.
- [x] Add deterministic native graph draft generation and `/api/mappings/native-graph/draft`.
- [x] Add fallback behavior when AI generation is requested but unavailable.
- [x] Add seeded generic native graph template IDs:
  - [x] `example-native-json2json-generic`
  - [x] `example-native-xml2json-generic`
- [x] Preserve existing native graph compatibility template `example-native-json2json`.

## Frontend Checklist

- [x] Add native graph type definitions for generic nodes and transforms.
- [x] Add API client/effect calls for native graph draft generation.
- [x] Add API client/effect calls for output diffing.
- [x] Add structured native graph JSON editor in the Mapping tab.
- [x] Add Generate draft, Validate graph, and Run graph actions.
- [x] Preserve deterministic visual mapping editor.
- [x] Save native graph specs as templates when one is active.
- [x] Load native graph templates back into the editor.
- [x] Show unresolved target paths from draft generation.
- [x] Display runtime trace rows in output preview.
- [x] Add path-level diff panel for target-vs-actual output comparison.

## Test Checklist

- [x] Existing deterministic rule tests continue passing.
- [x] Existing native graph compatibility tests continue passing.
- [x] JSON2JSON golden sample passes with a generic native graph template spec.
- [x] XML2JSON golden sample passes with a generic native graph template spec.
- [x] Deprecated compute operations remain covered by compatibility tests.
- [x] Draft-generation endpoint returns a graph and unresolved targets without AI.
- [x] AI-unavailable draft generation falls back to deterministic output.
- [x] Diff utility reports missing, extra, and changed paths.
- [x] Frontend typecheck covers native graph editor wiring.

## Review Notes

- The first generic seeded specs prove execution and persistence without deprecated compute operations, but they are template-style specs rather than fully decomposed hand-authored graph equivalents of every sample field.
- A future hardening pass should migrate the generic sample templates from literal/template-heavy specs into smaller reusable `map`, `filter`, `lookup`, `append`, and `conditional` nodes where that improves authoring clarity.
- Optional OpenRouter enhancement is intentionally limited to fallback behavior in this pass; deterministic generation is the supported path.
