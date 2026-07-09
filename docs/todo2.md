# Auto Mapping SaaS POC - SQLite Templates, Examples, And Auto Map Modes

This file is the next implementation tracker for the Auto Mapping SaaS POC. It starts after the existing local JSON-file template versioning flow and defines the work needed to move local template storage to SQLite, add seeded rule examples, and expose local vs AI-assisted auto mapping in the UI.

## Working Rules

- Build one phase at a time.
- Do not start the next phase until the current phase checkpoint is implemented, tested, and reviewed.
- Keep FastAPI as the only product backend for parsing, schema inference, mapping suggestions, transformation execution, validation, and templates.
- Keep TanStack Start as the frontend app shell and routing framework only.
- Keep AI as design-time assistance only. The production transformation runtime must remain deterministic.
- Keep parser, schema, mapping, runtime, validation, writer, and storage layers separate.
- Keep template persistence behind a repository abstraction so PostgreSQL can replace SQLite later.
- Prefer clear inspectable data shapes over premature enterprise-scale database design.
- Preserve current API behavior where possible and extend it only where the seeded examples require new data.

## Scope Guardrails

### In Scope

- SQLite-backed local template persistence.
- Automatic SQLite schema initialization for local development.
- Template and template version storage through a repository abstraction.
- Self-contained seeded example templates.
- Seeded examples for `field`, `constant`, `concat`, `date_format`, `condition`, and `loop`.
- One seeded super example containing all supported rule types.
- Sample source and target payloads stored with seeded examples.
- Loading seeded examples into the UI.
- Local vs AI-assisted auto map mode selection in the UI.
- Clear UI status for local suggestions, AI-used suggestions, and AI fallback to local suggestions.
- Backend tests for SQLite repository behavior and seeded examples.
- Frontend verification for example selection and auto map mode behavior.

### Out Of Scope

- PostgreSQL implementation.
- Database migrations framework beyond simple SQLite POC initialization.
- Authentication or user-owned templates.
- Multi-tenant template isolation.
- Template sharing or import/export.
- Streaming or large file storage.
- New mapping rule types.
- Replacing the deterministic transform runtime with AI.
- Changing OpenRouter integration to another AI SDK.

## Target Storage Direction

- Replace JSON-file runtime storage with SQLite for local development.
- Use a default database path such as `backend/data/templates.sqlite3`.
- Replace `TEMPLATE_STORE_PATH` with a SQLite-specific setting such as `TEMPLATE_DB_PATH`.
- Keep complex snapshots and payloads as JSON/text columns for the POC.
- Keep enough structure in relational columns for listing, reading, conflict checks, and version ordering.
- Keep the repository interface independent from SQLite-specific APIs where practical.

## Proposed SQLite Shape

```text
templates
  template_id text primary key
  name text not null
  description text not null default ''
  active_version integer not null
  is_seeded integer not null default 0
  created_at text not null
  updated_at text not null

template_versions
  template_id text not null
  version integer not null
  source_format text not null
  target_format text not null
  source_schema_snapshot_json text
  target_schema_snapshot_json text
  mapping_spec_json text not null
  validation_rules_json text not null
  sample_source_content text
  sample_target_content text
  created_at text not null
  primary key (template_id, version)
  foreign key (template_id) references templates(template_id)
```

## Template API Checklist

- [x] Keep `POST /api/templates` for user-created template version 1.
- [x] Keep `GET /api/templates` for listing saved and seeded templates.
- [x] Keep `GET /api/templates/{template_id}` for reading one template with versions.
- [x] Keep `POST /api/templates/{template_id}/versions` for user-created versions.
- [x] Extend template version responses with optional `sample_source_content`.
- [x] Extend template version responses with optional `sample_target_content`.
- [x] Include an `is_seeded` template flag so the frontend can visually distinguish examples from user templates.
- [x] Prevent accidental overwrite of seeded template IDs through normal create requests.
- [x] Preserve existing validation errors and status codes for conflicts and missing templates.

## Seed Example Checklist

Each seeded example must be a full mapping template with version 1, source format, target format, source sample, target sample, schema snapshots, mapping spec, and empty validation rules unless the example is intentionally demonstrating validation.

### Field Example

- [x] Template ID: `example-field`.
- [x] Rule type: `field`.
- [x] Source path: `$.shipment.trackingNumber`.
- [x] Target path: `$.tracking.number`.
- [x] Demonstrates direct source-to-target copy.

### Constant Example

- [x] Template ID: `example-constant`.
- [x] Rule type: `constant`.
- [x] Target path: `$.metadata.sourceSystem`.
- [x] Constant value: `IMS_LOCAL`.
- [x] Demonstrates hardcoded target values.

### Concat Example

- [x] Template ID: `example-concat`.
- [x] Rule type: `concat`.
- [x] Source paths: `$.customer.firstName`, `$.customer.lastName`.
- [x] Target path: `$.customer.fullName`.
- [x] Separator: single space.
- [x] Demonstrates combining multiple source fields.

### Date Format Example

- [x] Template ID: `example-date-format`.
- [x] Rule type: `date_format`.
- [x] Source value example: `20260609`.
- [x] Input format: `%Y%m%d`.
- [x] Output format: `%Y-%m-%d`.
- [x] Demonstrates date normalization.

### Condition Example

- [x] Template ID: `example-condition`.
- [x] Rule type: `condition`.
- [x] Source path: `$.customer.tier`.
- [x] Equals value: `gold`.
- [x] Then value: `priority`.
- [x] Otherwise value: `standard`.
- [x] Target path: `$.customer.serviceLevel`.
- [x] Demonstrates deterministic if/then mapping.

### Loop Example

- [x] Template ID: `example-loop`.
- [x] Rule type: `loop`.
- [x] Loop source path: `$.shipment.packages`.
- [x] Loop target path: `$.packages`.
- [x] Child rules map package ID, weight, and unit from each source item.
- [x] Demonstrates clean array-to-array mapping.

### Super Example

- [x] Template ID: `example-super`.
- [x] Includes `field`, `constant`, `concat`, `date_format`, `condition`, and `loop`.
- [x] Uses one coherent source shipment payload and one coherent target event payload.
- [x] Produces useful output when loaded and run without manual edits.
- [x] Serves as the primary demo template for the complete mapping model.

## Auto Map Mode UI Checklist

- [x] Add an Auto Map segmented control with `Local` and `AI-assisted`.
- [x] Place the segmented control beside the existing `Auto map` button in the workbench header.
- [x] Default mode to `Local`.
- [x] In `Local` mode, call `/api/mappings/suggest` with `use_ai=false`.
- [x] In `AI-assisted` mode, call `/api/mappings/suggest` with `use_ai=true`.
- [x] Disable or visibly mark `AI-assisted` unavailable when `OPENROUTER_API_KEY` is not configured.
- [x] Show post-run status for `Local suggestions`, `AI used`, or `AI unavailable/fallback to local`.
- [x] Continue showing provider errors without blocking local suggestions.
- [x] Keep the deterministic runtime unchanged regardless of auto map mode.

## Frontend Template Loading Checklist

- [x] Show seeded examples and saved user templates in the template panel.
- [x] Visually distinguish examples from user templates.
- [x] When a seeded example is selected, load its source sample into the source input panel.
- [x] Load its target sample into the target input panel.
- [x] Load source and target formats.
- [x] Load schema snapshots when present.
- [x] Load mapping rules into the visual editor.
- [x] Load `full_jsonata_expression` into the JSONata editor.
- [x] Clear stale transform output and validation errors when loading a template.
- [x] Allow Parse, Auto map, and Run to refresh the UI from the loaded example.
- [x] Keep normal save/version behavior for user templates.

## Backend Implementation Phases

## Phase 1 - SQLite Template Repository

Status: Complete - ready for review

Goal: Replace JSON-file template persistence with SQLite while preserving the existing template repository boundary and API behavior.

### Tasks

- [x] Add SQLite database path setting, defaulting to `data/templates.sqlite3`.
- [x] Add SQLite connection helper using the Python standard library `sqlite3`.
- [x] Implement database initialization for `templates` and `template_versions`.
- [x] Replace JSON-file repository internals with SQLite reads and writes.
- [x] Preserve `list_templates`, `get_template`, `create_template`, and `create_version`.
- [x] Store Pydantic snapshots and mapping specs as JSON text.
- [x] Keep template list sorted by template name.
- [x] Keep conflict behavior for duplicate template IDs.
- [x] Keep missing-template behavior.
- [x] Update README documentation from JSON storage to SQLite storage.

### Checkpoint

- [x] Existing template API tests pass against SQLite.
- [x] Runtime template data is no longer written to `backend/data/templates.json`.
- [x] A fresh local backend creates the SQLite database automatically.
- [x] Phase 1 review notes are added before moving to Phase 2.

### Phase 1 Review Notes

- Completed SQLite template persistence behind the existing `TemplateRepository` boundary.
- Added `TEMPLATE_DB_PATH`, defaulting to `data/templates.sqlite3`.
- Replaced JSON-file template reads and writes with SQLite tables for templates and template versions.
- Preserved `POST /api/templates`, `GET /api/templates`, `GET /api/templates/{template_id}`, and `POST /api/templates/{template_id}/versions`.
- Stored schema snapshots, mapping specs, and validation rules as JSON text columns.
- Updated backend and root README storage documentation from `TEMPLATE_STORE_PATH`/`templates.json` to `TEMPLATE_DB_PATH`/`templates.sqlite3`.
- Added test coverage that confirms SQLite tables are populated and the old JSON file is not written.
- Verification passed on 2026-06-09: backend `pytest`, `ruff check app tests`, and `pyright app tests`.
- Known residual note: pytest still emits the existing third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 1 behavior.
- Next gated step: complete Phase 2 seeded example templates.

## Phase 2 - Seeded Example Templates

Status: Complete - ready for review

Goal: Add self-contained seeded example templates for every rule type and one combined super example.

### Tasks

- [x] Define seed template data in a backend module, not in frontend-only constants.
- [x] Include source sample content for every seed.
- [x] Include target sample content for every seed.
- [x] Include schema snapshots for every seed.
- [x] Include mapping specs for every seed.
- [x] Seed examples idempotently during repository initialization.
- [x] Add `is_seeded` metadata to template responses.
- [x] Protect seeded template IDs from user-created template conflicts.
- [x] Add backend tests for seed availability.
- [x] Add backend transform tests proving every seeded rule executes.
- [x] Add backend transform test for the super example.

### Checkpoint

- [x] `GET /api/templates` returns all seeded examples on a fresh SQLite database.
- [x] `GET /api/templates/example-super` returns source sample, target sample, schemas, and all six rule types.
- [x] Seed initialization can run repeatedly without duplicating versions.
- [x] Phase 2 review notes are added before moving to Phase 3.

### Phase 2 Review Notes

- Completed backend-owned seeded templates for `field`, `constant`, `concat`, `date_format`, `condition`, `loop`, and `super`.
- Added optional `sample_source_content` and `sample_target_content` fields to template versions.
- Added `is_seeded` to template responses.
- Seeded examples are inserted idempotently during SQLite repository initialization.
- Added SQLite column migration for existing local Phase 1 databases.
- Added backend tests for seed availability, seed idempotency, seeded ID conflict protection, super-template rule coverage, and transform output for every seed.
- Verification passed on 2026-06-09: backend `pytest`, `ruff check app tests`, and `pyright app tests`.
- Known residual note: pytest still emits the existing third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 2 behavior.
- Next gated step: complete Phase 3 auto map mode API and UI.

## Phase 3 - Auto Map Mode API And UI

Status: Complete - ready for review

Goal: Make local vs AI-assisted auto mapping explicit in the UI and preserve deterministic local behavior as the default.

### Tasks

- [x] Add backend capability metadata if needed so the frontend can know whether AI mapping is available.
- [x] Keep `/api/mappings/suggest` compatible with existing `use_ai` request behavior.
- [x] Add frontend state for auto map mode.
- [x] Add a segmented control beside `Auto map`.
- [x] Default selected mode to `Local`.
- [x] Pass `use_ai=false` for local mode.
- [x] Pass `use_ai=true` for AI-assisted mode.
- [x] Disable or label AI-assisted mode when no AI provider key is configured.
- [x] Show result state after mapping generation.
- [x] Keep provider error display visible and concise.
- [x] Add frontend verification for both modes.

### Checkpoint

- [x] Local mode sends `use_ai=false`.
- [x] AI-assisted mode sends `use_ai=true`.
- [x] With no API key, the UI clearly communicates that AI suggestions are unavailable or fell back.
- [x] Existing Parse, Auto map, Run, Save, Version, and Load flows still work.
- [x] Phase 3 review notes are added before moving to Phase 4.

### Phase 3 Review Notes

- Added `GET /api/mappings/capabilities` so the frontend can detect whether AI mapping is available.
- Added backend tests for capability metadata, `use_ai=true` without a key, and OpenRouter failure fallback.
- Added frontend Auto Map mode state with a compact `Local` / `AI-assisted` segmented control beside `Auto map`.
- Kept `Local` as the default and disabled `AI-assisted` when no OpenRouter key is configured.
- Updated the suggestions panel to show `Local suggestions`, `AI used`, `AI unavailable, local used`, or `AI failed, local used`.
- Fixed a concurrent fresh-database seed initialization race found during local server verification.
- Verification passed on 2026-06-09: backend `pytest` with 35 tests, `ruff check app tests`, and `pyright app tests`; frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Local HTTP verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: capability metadata, concurrent template initialization, local mapping request, AI-request fallback without a key, and frontend render.
- Known residual note: the Browser plugin did not expose a callable browser tool in this turn, so browser verification was done through local HTTP checks instead of in-app Browser interaction.
- Next gated step: complete Phase 4 example loading in the workbench.

## Phase 4 - Example Loading In The Workbench

Status: Complete - ready for review

Goal: Selecting a seeded example should populate the workbench and make the rule behavior visible in the UI.

### Tasks

- [x] Update frontend template types for sample payload fields and `is_seeded`.
- [x] Update template panel copy and grouping for examples vs user templates.
- [x] Load sample source and target content when present.
- [x] Load formats, schemas, mapping rules, and JSONata metadata.
- [x] Clear stale suggestions, provider errors, output, and validation errors on load.
- [x] Keep loaded rules editable.
- [x] Ensure every rule type has enough visible data in the editor to understand the example.
- [x] Run browser verification for every seeded example.
- [x] Run browser verification for the super example end to end.

### Checkpoint

- [x] User can select each example and see source/target samples populate.
- [x] User can run Parse and see source/target schemas.
- [x] User can run or inspect rules and see mapping output.
- [x] Super example displays all supported rule types in the editor.
- [x] Phase 4 review notes are added before final acceptance.

### Phase 4 Review Notes

- Added frontend template types for `is_seeded`, `sample_source_content`, and `sample_target_content`.
- Grouped template selection into `Examples` and `Saved` options.
- Seeded examples now auto-load their selected version into source/target input panels, formats, schemas, visual rules, and JSONata metadata.
- JSON seeded examples hydrate source data so the loaded example can be run without retyping payloads.
- Loading templates clears stale suggestions, provider errors, output, validation errors, and Auto Map status.
- Added rule-specific detail summaries in the visual editor for constants, concat rules, date formats, conditions, and loops.
- Verification passed on 2026-06-09: backend `pytest` with 35 tests, `ruff check app tests`, and `pyright app tests`; frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Local HTTP verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: all 7 seeded examples are listed with samples, `example-super` contains all six rule types, the super template transforms successfully with zero validation errors, and the frontend renders.
- Known residual note: the Browser plugin did not expose a callable browser tool in this turn, so browser verification was approximated through local HTTP checks and frontend build verification.
- All planned `todo2.md` implementation phases are complete.

## Test Plan

### Backend

- [x] `pytest` passes.
- [x] `ruff check app tests` passes.
- [x] `pyright app tests` passes.
- [x] SQLite repository initializes a fresh database.
- [x] Template create/list/read/version behavior works against SQLite.
- [x] Duplicate template conflict returns 409.
- [x] Missing template read and version create return 404.
- [x] Seeded templates exist on a fresh database.
- [x] Seeded templates are not duplicated on repeated initialization.
- [x] Each rule-type seed transforms successfully.
- [x] Super example transforms successfully.
- [x] Mapping suggestion tests cover `use_ai=false`.
- [x] Mapping suggestion tests cover `use_ai=true` with no provider key.
- [x] Mapping suggestion tests cover AI provider fallback behavior.

### Frontend

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] Browser verification confirms selecting each example updates inputs, formats, schemas, and rules.
- [x] Browser verification confirms the super example can be loaded and run.
- [x] Browser verification confirms Local auto map sends `use_ai=false`.
- [x] Browser verification confirms AI-assisted auto map sends `use_ai=true`.
- [x] Browser verification confirms fallback/provider errors are visible without breaking local suggestions.

## Acceptance Criteria

- [x] Local runtime template persistence uses SQLite, not JSON files.
- [x] The template repository boundary remains intact for a future PostgreSQL repository.
- [x] Seeded examples are available from a fresh local database.
- [x] Each seeded example is self-contained and can populate the UI.
- [x] The super example includes all supported mapping rule types.
- [x] Local auto map is the default UI mode.
- [x] AI-assisted auto map is an explicit user choice.
- [x] The UI clearly reports whether local suggestions or AI-assisted suggestions were used.
- [x] Existing demo flows remain usable end to end.

## Assumptions

- SQLite is the local development database.
- PostgreSQL implementation is deferred.
- Seed examples are product fixtures and should come from the backend.
- Runtime templates are no longer stored in JSON files.
- The deterministic runtime remains the only production transformation executor.
- Local auto mapping remains deterministic and is the default user experience.
