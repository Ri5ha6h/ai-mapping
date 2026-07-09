# Auto Mapping SaaS POC - Implementation Todo

This file is the phase-by-phase implementation tracker for the Auto Mapping SaaS POC. Update this file when each phase is started, completed, reviewed, or blocked.

## Working Rules

- Build one phase at a time.
- Do not start the next phase until the current phase checkpoint is implemented, tested, and reviewed.
- Keep FastAPI as the only product backend for parsing, schema inference, mapping suggestions, transformation execution, validation, and templates.
- Use TanStack Start only as the frontend app shell, routing, and build framework.
- AI is design-time assistance only. The production transformation runtime must remain deterministic.
- Parse every supported source format into canonical JSON before mapping.
- Keep parser, schema, mapping, runtime, validation, writer, and storage layers separate.
- Prefer clarity and inspectability over enterprise-scale optimization for the POC.
- Preserve code boundaries so future streaming support can be added later, but do not implement 5GB streaming in this POC.

## Scope Guardrails

### In Scope

- JSON to JSON mapping.
- XML to JSON mapping.
- JSON to XML mapping.
- XML to XML only if easy after the main flows work.
- Basic inbound EDI 214 parsing to canonical JSON.
- Basic inbound EDI 856 parsing to canonical JSON.
- Canonical JSON representation.
- Schema inference from source and target samples.
- Rule-based mapping suggestions.
- Optional OpenRouter-assisted mapping suggestions when `OPENROUTER_API_KEY` is configured.
- Visual mapping editor.
- Advanced JSONata expression editing.
- Deterministic synchronous mapping execution.
- JSON and XML output writing.
- Validation errors.
- Local reusable mapping templates.
- Template versioning.

### Out of Scope

- CSV support.
- 5GB file processing implementation.
- Async job queue.
- Authentication.
- Multi-tenancy.
- PDF extraction.
- Scanned image extraction.
- Email body extraction.
- Full IDP workflow.
- Partner-facing implementation guide portal.
- Webhook delivery.
- iPaaS connectors such as Tray.ai, Zapier, MuleSoft, or Boomi.
- Production deployment hardening.
- Outbound EDI generation.
- Full X12 compliance validation.

## Target Stack

### Backend

- Python `3.14.5` target runtime.
- Python `3.13.x` allowed only as a documented compatibility fallback.
- FastAPI `0.136.3`.
- Pydantic `2.13.4`.
- Uvicorn `0.49.0`.
- pytest `9.0.3`.
- httpx `0.28.1`.
- respx `0.23.1`.
- Ruff `0.15.16`.
- Pyright `1.1.410`.
- orjson `3.11.9` only where useful.
- defusedxml `0.7.1` for safe XML parsing.
- lxml `6.1.1` only if richer XML writing is needed.
- Optional OpenRouter integration through direct `httpx` REST calls.
- Do not add the `openai` package for this POC.

### Frontend

- Node.js LTS.
- pnpm.
- TanStack Start.
- React.
- TypeScript.
- TanStack Router through TanStack Start.
- TanStack Query only if useful for server state.
- shadcn/UI with Base UI primitive support using `template=start` and `base=base`.
- Tailwind CSS through the scaffold.
- Effect for typed API calls, decoding, retries, async flows, and structured frontend errors.
- Monaco editor for JSONata editing.
- lucide-react for icons.

## Expected Architecture

```text
Source Input
  -> Format Parser
  -> Canonical JSON
  -> Schema Inference
  -> Mapping Suggestion Engine
  -> Visual Mapping Editor / JSONata Editor
  -> Deterministic Mapping Runtime
  -> Validation Engine
  -> JSON or XML Output
  -> Save Versioned Mapping Template
```

## Suggested Project Structure

```text
backend/
  app/
    main.py
    config/
      settings.py
    api/
      routes_parse.py
      routes_schema.py
      routes_mapping.py
      routes_transform.py
      routes_templates.py
      models.py
    core/
      parsers/
        json_parser.py
        xml_parser.py
        edi_214_parser.py
        edi_856_parser.py
      schema/
        infer_schema.py
        schema_types.py
      mapping/
        rule_based_suggester.py
        ai_suggester.py
        openrouter_provider.py
        deterministic_rule_runtime.py
        optional_jsonata_runtime.py
        mapping_model.py
      validation/
        validator.py
        validation_models.py
      writers/
        json_writer.py
        xml_writer.py
      storage/
        template_repository.py
    tests/
      test_json_to_json.py
      test_xml_to_json.py
      test_json_to_xml.py
      test_edi_214.py
      test_edi_856.py

frontend/
  src/
    routes/
      index.tsx
    components/
      ui/
      workbench/
        SourceInputPanel.tsx
        TargetInputPanel.tsx
        SchemaViewer.tsx
        MappingSuggestionPanel.tsx
        VisualMappingEditor.tsx
        JsonataEditor.tsx
        OutputPreview.tsx
        ValidationPanel.tsx
        TemplateVersionPanel.tsx
    lib/
      api/
        client.ts
      effect/
        api_effects.ts
        errors.ts
        schemas.ts
    types/
      mapping.ts
      schema.ts
      validation.ts
```

## API Contract Checklist

- [x] `POST /api/parse` parses raw JSON, XML, EDI 214, or EDI 856 into canonical JSON.
- [x] `POST /api/schema/infer` infers a schema from canonical JSON.
- [x] `POST /api/mappings/suggest` generates mapping suggestions with confidence scores.
- [x] `POST /api/transform` executes a mapping synchronously and returns JSON or XML output.
- [x] `POST /api/validate` validates output against target schema and mapping rules.
- [x] `POST /api/templates` saves a mapping template.
- [x] `GET /api/templates` lists saved templates.
- [x] `GET /api/templates/{template_id}` reads one template with versions.
- [x] `POST /api/templates/{template_id}/versions` creates a new template version.

## Mapping Model Checklist

- [x] Define template metadata: `template_id`, `name`, `description`, `active_version`, `versions`.
- [x] Store `source_format` and `target_format`.
- [x] Store source and target schema snapshots.
- [x] Store `mapping_spec.engine`.
- [x] Store structured rules.
- [x] Store `full_jsonata_expression`.
- [x] Store validation rules.
- [x] Store `created_at`.
- [x] Support rule type `field`.
- [x] Support rule type `constant`.
- [x] Support rule type `concat`.
- [x] Support rule type `date_format`.
- [x] Support rule type `condition`.
- [x] Support rule type `loop`.

## Validation Error Checklist

- [ ] Invalid source format.
- [ ] Invalid target sample format.
- [x] Missing source path.
- [x] Unmapped required target field.
- [x] Type mismatch.
- [x] Failed transformation.
- [x] Invalid JSONata expression.
- [x] Output does not match inferred or edited target schema.

## Phase 1 - Backend Foundation

Status: Complete - accepted

Goal: Create the backend foundation and prove JSON, XML, EDI 214, and EDI 856 samples can be parsed into canonical JSON and schema-inferred.

### Tasks

- [x] Create backend project structure.
- [x] Configure Python target runtime and dependency management.
- [x] Add FastAPI app entrypoint.
- [x] Add settings module for environment configuration.
- [x] Add shared Pydantic API models.
- [x] Implement `POST /api/parse`.
- [x] Implement `POST /api/schema/infer`.
- [x] Implement JSON parser.
- [x] Implement safe XML parser with `defusedxml`.
- [x] Implement basic X12 segment parser shared by EDI 214 and EDI 856 flows.
- [x] Implement EDI 214 parser into canonical JSON.
- [x] Implement EDI 856 parser into canonical JSON.
- [x] Preserve raw EDI segment data for debugging.
- [x] Implement canonical JSON response models.
- [x] Implement schema inference for objects, arrays, strings, numbers, booleans, and nulls.
- [x] Add sample data files for JSON, XML, EDI 214, and EDI 856.
- [x] Add backend unit tests for JSON parsing.
- [x] Add backend unit tests for XML parsing.
- [x] Add backend unit tests for invalid XML errors.
- [x] Add backend unit tests for EDI 214 parsing.
- [x] Add backend unit tests for EDI 856 parsing.
- [x] Add backend unit tests for schema inference.
- [x] Add lint and type-check commands.
- [x] Document Python version actually used. If falling back to Python 3.13.x, document why.

### Checkpoint

- [x] Backend tests pass.
- [x] JSON source parses into canonical JSON.
- [x] XML source parses into canonical JSON.
- [x] EDI 214 sample parses into canonical JSON.
- [x] EDI 856 sample parses into canonical JSON.
- [x] Schema inference works for parsed canonical JSON.
- [x] FastAPI app starts locally.
- [x] Example curl requests exist for JSON, XML, EDI 214, and EDI 856 parsing.
- [x] Phase 1 review notes added below before moving to Phase 2.

### Phase 1 Review Notes

- Completed Phase 1 backend foundation using local Python `3.14.5`; no Python fallback was needed.
- Created FastAPI app with `POST /api/parse` and `POST /api/schema/infer`.
- Added parsers for JSON, XML via `defusedxml`, and basic EDI 214/856 canonicalization through a shared X12 segment parser.
- Added sample files under `backend/samples`.
- Verification passed on 2026-06-08: `pytest`, `ruff check .`, and `pyright`.
- Local server verification passed: `uvicorn app.main:app --host 127.0.0.1 --port 8000` accepted a JSON parse request and returned canonical JSON.
- Known residual note: pytest emits a third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 1 behavior.
- Phase 1 accepted by user on 2026-06-08.
- Next gated step: complete Phase 2 mapping suggestion engine.

## Phase 2 - Mapping Suggestion Engine

Status: Complete - accepted

Goal: Generate useful mapping suggestions from source and target schemas using deterministic heuristics first, with optional OpenRouter assistance.

### Tasks

- [x] Define mapping suggestion request and response models.
- [x] Implement `POST /api/mappings/suggest`.
- [x] Implement normalized field name matching.
- [x] Implement path-ending matching.
- [x] Implement primitive type compatibility scoring.
- [x] Add logistics synonyms for tracking number, shipment id, carrier, event code, date, location, quantity, item, container, and order.
- [x] Return mapping suggestions with source path, target path, rule type, confidence, and JSONata metadata.
- [x] Add optional AI suggester interface.
- [x] Add OpenRouter provider using direct `httpx` REST calls.
- [x] Support `OPENROUTER_API_KEY`.
- [x] Support optional `OPENROUTER_MODEL`.
- [x] Support optional `OPENROUTER_HTTP_REFERER`.
- [x] Support optional `OPENROUTER_APP_TITLE`.
- [x] Ensure app works fully without `OPENROUTER_API_KEY`.
- [x] Add tests for rule-based suggestions.
- [x] Add tests for OpenRouter provider with `respx`.
- [x] Add tests proving no-key fallback works.

### Checkpoint

- [x] Given source and target schemas, backend returns useful mapping suggestions.
- [x] Suggestions include confidence scores.
- [x] Suggestions include editable mapping rule data.
- [x] Optional OpenRouter calls are mocked and tested.
- [x] Rule-based fallback works without external API access.
- [x] Phase 2 review notes added below before moving to Phase 3.

### Phase 2 Review Notes

- Completed Phase 2 mapping suggestion backend.
- Added `POST /api/mappings/suggest` with structured request/response models.
- Added deterministic rule-based suggestions using normalized field names, path endings, primitive type compatibility, and logistics synonym groups.
- Suggestions return editable rule data: `id`, `type`, `source_path`, `target_path`, `required`, `confidence`, `jsonata`, `explanation`, and `source`.
- Added optional OpenRouter provider behind an AI suggester interface using direct `httpx` REST calls only.
- Supported `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_HTTP_REFERER`, and `OPENROUTER_APP_TITLE`.
- Verified no-key fallback works and returns `used_ai: false`.
- Verification passed on 2026-06-08: `pytest`, `ruff check .`, and `pyright`.
- Added `respx` tests for mocked OpenRouter suggestions and API-level AI merge behavior.
- Local server smoke test passed: `/api/mappings/suggest` returned tracking number, carrier, and city suggestions with confidence scores and no provider errors.
- Known residual note: pytest still emits a third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 2 behavior.
- Phase 2 accepted by user on 2026-06-08.
- Next gated step: complete Phase 3 deterministic transformation runtime.

## Phase 3 - Deterministic Transformation Runtime

Status: Complete - accepted

Goal: Execute mappings synchronously with deterministic backend logic and produce JSON or XML output with validation errors.

### Tasks

- [x] Define mapping runtime models.
- [x] Implement `POST /api/transform`.
- [x] Implement `POST /api/validate`.
- [x] Implement deterministic executor for `field` rules.
- [x] Implement deterministic executor for `constant` rules.
- [x] Implement deterministic executor for `concat` rules.
- [x] Implement deterministic executor for `date_format` rules.
- [x] Implement deterministic executor for simple `condition` rules.
- [x] Implement deterministic executor for basic clean-array `loop` rules.
- [x] Keep JSONata expressions as editable/generated metadata.
- [x] Add optional JSONata runtime stub or adapter boundary if needed.
- [x] Implement JSON output writer.
- [x] Implement XML output writer.
- [x] Implement validation for missing source paths.
- [x] Implement validation for unmapped required target fields.
- [x] Implement validation for type mismatches.
- [x] Implement validation for transformation failures.
- [x] Implement validation for invalid JSONata expression metadata where applicable.
- [x] Add tests for JSON to JSON transformation.
- [x] Add tests for XML to JSON transformation.
- [x] Add tests for JSON to XML transformation.
- [x] Add tests for EDI-derived canonical JSON to JSON.
- [x] Add tests for EDI-derived canonical JSON to XML.
- [x] Add tests for missing required target field validation.
- [x] Add tests for invalid source path validation.

### Checkpoint

- [x] JSON to JSON execution works.
- [x] XML to JSON execution works.
- [x] JSON to XML execution works.
- [x] EDI 214 canonical JSON to JSON/XML execution works.
- [x] EDI 856 canonical JSON to JSON/XML execution works.
- [x] Validation errors are clear and structured.
- [x] AI is not used during transformation execution.
- [x] Phase 3 review notes added below before moving to Phase 4.

### Phase 3 Review Notes

- Completed Phase 3 deterministic transformation runtime.
- Added `POST /api/transform` and `POST /api/validate`.
- Added runtime models for transform requests, validation requests, mapping rules, conditions, loops, output formats, and structured validation errors.
- Implemented deterministic rule execution for `field`, `constant`, `concat`, `date_format`, `condition`, and basic clean-array `loop`.
- Added JSON writer and XML writer.
- Kept JSONata as editable metadata only; transformation execution does not use AI or JSONata.
- Added validation for missing source paths, unmapped required target fields, type mismatches, failed transformations, and invalid JSONata metadata.
- Verification passed on 2026-06-08: `pytest`, `ruff check .`, and `pyright`.
- Added tests for JSON to JSON, XML to JSON, JSON to XML, EDI 214 to JSON/XML, EDI 856 to JSON/XML, missing source path validation, invalid source path validation, unmapped required target validation, type mismatch validation, and invalid JSONata metadata.
- Local server smoke test passed: `/api/transform` returned JSON output for tracking and carrier rules with no validation errors.
- Updated `backend/README.md` with `/api/transform` and `/api/validate` curl examples.
- Known residual note: pytest still emits a third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 3 behavior.
- Phase 3 accepted by user on 2026-06-08.
- Next gated step: complete Phase 4 frontend mapping workbench.

## Phase 4 - Frontend Mapping Workbench

Status: Complete - accepted

Goal: Build a usable workbench UI that lets the user paste/upload samples, infer schemas, request suggestions, edit mappings, edit JSONata metadata, run transformations, and view validation/output.

### Tasks

- [x] Create TanStack Start frontend with pnpm.
- [x] Scaffold shadcn/UI with Base UI primitive support.
- [x] Configure Tailwind CSS.
- [x] Add lucide-react.
- [x] Add Monaco editor.
- [x] Add Effect.
- [x] Add frontend API client that calls FastAPI only.
- [x] Add Effect-backed parse workflow.
- [x] Add Effect-backed schema inference workflow.
- [x] Add Effect-backed mapping suggestion workflow.
- [x] Add Effect-backed transform workflow.
- [x] Add Effect-backed validation workflow.
- [x] Add Source input panel with paste/upload and source format selection.
- [x] Add Target input panel with paste/upload and target output format selection.
- [x] Add parse and infer schema action.
- [x] Add auto map / AI map action.
- [x] Add source schema viewer.
- [x] Add target schema viewer.
- [x] Add mapping suggestion table/editor.
- [x] Allow editing source path.
- [x] Allow editing target path.
- [x] Allow editing rule type.
- [x] Allow editing JSONata per rule.
- [x] Add advanced JSONata editor.
- [x] Add output preview panel.
- [x] Add validation panel with plain-language errors.
- [x] Add save template button placeholder or disabled state if Phase 5 is not complete.
- [x] Add template version panel placeholder or disabled state if Phase 5 is not complete.
- [x] Verify full UI flow against local backend.

### Checkpoint

- [x] User can paste JSON source and JSON target sample.
- [x] User can parse and infer schemas from UI.
- [x] User can generate mapping suggestions from UI.
- [x] User can edit mappings visually.
- [x] User can edit advanced JSONata metadata.
- [x] User can run transformation multiple times.
- [x] User can see validation errors.
- [x] User can see JSON or XML output preview.
- [x] Frontend does not implement product/domain APIs through TanStack server functions.
- [x] Phase 4 review notes added below before moving to Phase 5.

### Phase 4 Review Notes

- Completed Phase 4 frontend mapping workbench.
- Created `frontend/` using TanStack Start, pnpm, Tailwind CSS, shadcn/UI with Base UI primitive support, lucide icons, Effect, and Monaco.
- Added local shadcn/UI components for buttons, cards, inputs, textareas, tabs, and selects through the scaffold/CLI.
- Added typed frontend API client that calls FastAPI only; no TanStack Start server functions were added for product/domain APIs.
- Added Effect-backed parse, schema inference, mapping suggestion, transform, and validation workflows.
- Added source and target input panels with paste/upload and format controls.
- Added source schema viewer, target schema viewer, mapping suggestion panel, visual rule editor, advanced JSONata editor, output preview, validation panel, and Phase 5-disabled template/version controls.
- Added backend CORS defaults for local frontend ports `3000` through `3005`.
- Verification passed on 2026-06-08: frontend `pnpm typecheck`, `pnpm lint`, and `pnpm build`; backend `pytest`, `ruff check .`, and `pyright`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3001`: Parse, Auto map, Run, schema display, mapping suggestions, editable rules, output preview, validation panel, and mobile layout visibility.
- Removed TanStack Devtools from the root shell because it caused SSR hydration errors in the local TanStack Start dev server.
- Phase 4 accepted by user on 2026-06-09.
- Next gated step: complete Phase 5 template versioning.

## Phase 5 - Template Versioning

Status: Complete - accepted

Goal: Save, reload, and version mapping templates using local JSON file storage behind a repository abstraction.

### Tasks

- [x] Implement template repository abstraction.
- [x] Implement local JSON file storage.
- [x] Define template create/read/list/version models.
- [x] Implement `POST /api/templates`.
- [x] Implement `GET /api/templates`.
- [x] Implement `GET /api/templates/{template_id}`.
- [x] Implement `POST /api/templates/{template_id}/versions`.
- [x] Save schema snapshots with each version.
- [x] Save mapping spec with each version.
- [x] Save validation rules with each version.
- [x] Update frontend save template action.
- [x] Update frontend template version list.
- [x] Allow loading an existing template back into the editor.
- [x] Add backend tests for saving template version 1.
- [x] Add backend tests for creating version 2.
- [x] Add frontend verification for save/reload/version flow.

### Checkpoint

- [x] User can save a mapping template.
- [x] User can list saved templates.
- [x] User can reload a saved template.
- [x] User can create a new template version.
- [x] Template storage remains behind an abstraction for future PostgreSQL support.
- [x] Phase 5 review notes added below before moving to Phase 6.

### Phase 5 Review Notes

- Completed Phase 5 template versioning.
- Added local JSON template persistence behind `TemplateRepository`, with `TEMPLATE_STORE_PATH` defaulting to `data/templates.json`.
- Added template API models for metadata, versions, schema snapshots, mapping specs, validation rules, and creation timestamps.
- Added `POST /api/templates`, `GET /api/templates`, `GET /api/templates/{template_id}`, and `POST /api/templates/{template_id}/versions`.
- Added frontend template controls for naming a template, saving version 1, selecting saved templates, creating new versions, refreshing the list, and loading a selected version back into the editor.
- Added backend tests covering save version 1, list/read, create version 2, conflict handling, and missing-template errors.
- Updated `backend/README.md` with template endpoint curl examples.
- Verification passed on 2026-06-09: backend `pytest`, `ruff check app tests`, and `pyright app tests`; frontend `pnpm lint` and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: Parse, Auto map, Save template v1, Create version 2, Load version back into editor, and no browser console errors or hydration warnings.
- Known residual note: pytest still emits a third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 5 behavior.
- Phase 5 accepted by user on 2026-06-09.
- Next gated step: review Phase 5 before starting Phase 6 polish and demo scenarios.

## Phase 6 - Polish and Demo Scenarios

Status: Complete - ready for review

Goal: Make the POC demoable end to end with samples, setup instructions, clean states, and scripted scenarios.

### Tasks

- [x] Add sample source JSON file.
- [x] Add sample target JSON file.
- [x] Add sample target XML file.
- [x] Add basic EDI 214 sample file.
- [x] Add basic EDI 856 sample file.
- [x] Add clear backend README setup instructions.
- [x] Add clear frontend README setup instructions.
- [x] Add root README with full local startup flow.
- [x] Document backend and frontend dev server commands.
- [x] Document lint, type-check, and test commands.
- [x] Add demo script for JSON to JSON.
- [x] Add demo script for XML to JSON.
- [x] Add demo script for JSON to XML.
- [x] Add demo script for EDI 214 to JSON/XML.
- [x] Add demo script for EDI 856 to JSON/XML.
- [x] Add UI empty states.
- [x] Add UI loading states.
- [x] Add UI error states.
- [x] Run backend tests.
- [x] Run backend lint.
- [x] Run backend type check.
- [x] Run frontend checks.
- [x] Verify end-to-end demo flow in browser.

### Checkpoint

- [x] App starts locally using README instructions.
- [x] Backend and frontend run separately during development.
- [x] JSON to JSON demo works.
- [x] XML to JSON demo works.
- [x] JSON to XML demo works.
- [x] EDI 214 canonicalization and mapping demo works.
- [x] EDI 856 canonicalization and mapping demo works.
- [x] Validation error demo works.
- [x] Template save/version demo works.
- [x] Phase 6 review notes added below.

### Phase 6 Review Notes

- Completed Phase 6 polish and demo scenarios.
- Added root `README.md` with fresh setup, separate backend/frontend startup, checks, demo scripts, and browser demo flow.
- Replaced the scaffold frontend README with project-specific run/check/demo instructions.
- Updated backend README with sample files, isolated template storage, and demo script usage.
- Added target sample files `backend/samples/target.json` and `backend/samples/target.xml`.
- Added stdlib-only backend demo runner plus scripts for JSON to JSON, XML to JSON, JSON to XML, EDI 214 to JSON/XML, and EDI 856 to JSON/XML.
- Added frontend demo scenario strip for loading JSON, XML, and EDI review flows.
- Added clearer UI loading feedback with a live busy banner while retaining existing empty and error states.
- Adjusted frontend XML-output validation so XML transformation output is not incorrectly validated as a JSON object.
- Verification passed on 2026-06-09: backend `pytest`, `ruff check app tests`, and `pyright app tests`; frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Demo scripts passed against FastAPI on `127.0.0.1:8000`: JSON to JSON, XML to JSON, JSON to XML, EDI 214 to JSON/XML, and EDI 856 to JSON/XML.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: scenario loading, Parse, Auto map, JSON to XML Run, Save template v1, Create version 2, Load version back into editor, and no browser console errors or hydration warnings.
- Known residual note: pytest still emits a third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 6 behavior.
- Next gated step: review Phase 6 and final acceptance criteria.

## Final Acceptance Criteria

- [x] App starts locally with clear README instructions.
- [x] Backend and frontend run separately during development.
- [x] User can paste JSON source and JSON target sample, generate mapping, edit it, run it, and see JSON output.
- [x] User can paste XML source and JSON target sample, generate mapping, edit it, run it, and see JSON output.
- [x] User can paste JSON source and XML target sample, generate mapping, edit it, run it, and see XML output.
- [x] User can paste basic EDI 214 and convert it to canonical JSON.
- [x] User can paste basic EDI 856 and convert it to canonical JSON.
- [x] User can map EDI-derived canonical JSON to JSON or XML target output.
- [x] User can see validation errors for missing required fields, invalid paths, invalid formats, and transformation failures.
- [x] User can save a mapping template and create a new version.
- [x] OpenRouter integration is optional.
- [x] System works without an OpenRouter API key.
- [x] AI is never required for deterministic execution.

## Minimum Test Cases

- [x] JSON source to JSON target output.
- [x] XML source to JSON target output.
- [x] JSON source to XML target output.
- [x] EDI 214 to canonical JSON.
- [x] EDI 856 to canonical JSON.
- [x] EDI 214 canonical JSON to JSON target output.
- [x] Missing required target field validation.
- [x] Invalid source path validation.
- [x] Invalid XML input error.
- [x] Save template version 1 and create version 2.

## Current Next Step

Review Phase 6 and final acceptance criteria:

1. Review README setup flow, sample files, demo scripts, and browser workflow.
2. Confirm Phase 6 is accepted or record requested changes in the Phase 6 review notes.
3. After approval, the POC implementation checklist is complete.
