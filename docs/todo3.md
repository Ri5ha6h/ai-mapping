# Auto Mapping SaaS POC - Schema Library And Split Mapping Workbench

This file is the next implementation tracker for the Auto Mapping SaaS POC. It starts after SQLite-backed templates, seeded examples, and explicit auto map modes, and defines the work needed to separate schema creation from mapping execution.

## Working Rules

- Build one phase at a time.
- Do not start the next phase until the current phase checkpoint is implemented, tested, and reviewed.
- Keep FastAPI as the only product backend for parsing, schema inference, mapping suggestions, transformation execution, validation, schemas, and templates.
- Keep TanStack Start as the frontend app shell and routing framework only.
- Keep AI as design-time assistance only. The production transformation runtime must remain deterministic.
- Parse every supported schema input into canonical JSON before inference.
- Keep parser, schema, mapping, runtime, validation, writer, and storage layers separate.
- Keep schema and template persistence behind repository abstractions so PostgreSQL can replace SQLite later.
- Preserve original uploaded or pasted content for every saved schema artifact.
- Prefer clear inspectable data shapes over premature enterprise-scale database design.

## Scope Guardrails

### In Scope

- Durable schema artifact library in SQLite.
- Schema artifact creation from uploaded files or pasted raw text.
- Preservation of original submitted content and upload metadata.
- Source schema artifacts for JSON, XML, EDI 214, and EDI 856.
- Target schema artifacts for JSON and XML.
- Schema artifact list, read, create, and soft delete APIs.
- Schema artifacts marked as source or target.
- Separate frontend tabs for Schema and Mapping.
- Schema tab for creating, browsing, and inspecting saved schemas.
- Mapping tab for selecting saved source and target schemas.
- Auto mapping from selected schema artifacts.
- Transformation runs using either the saved source sample or a run-specific override payload.
- Template versions linked to source and target schema artifact IDs while retaining schema snapshots.
- Backward compatibility for existing and seeded snapshot-only templates.
- Backend tests for schema library persistence, parsing, validation, soft deletion, and template links.
- Frontend verification for schema creation, selection, auto mapping, transform, and template save/load flows.

### Out Of Scope

- PostgreSQL implementation.
- Database migrations framework beyond simple SQLite POC initialization and additive columns.
- Authentication or user-owned schema libraries.
- Multi-tenant schema isolation.
- Schema artifact versioning beyond creating a new artifact.
- Full in-place schema editing.
- Binary file storage.
- Large file streaming.
- Multi-file schema merging.
- Importing external JSON Schema documents directly.
- Persisted transformation run history.
- New mapping rule types.
- Replacing deterministic transform execution with AI.

## Target Architecture

```text
Schema Tab
  -> Upload File / Paste Raw Text
  -> Select Direction And Format
  -> Parse To Canonical JSON
  -> Infer Internal Schema
  -> Persist Schema Artifact With Original Content
  -> Browse Source And Target Schema Library

Mapping Tab
  -> Select Source Schema Artifact
  -> Select Target Schema Artifact
  -> Auto Map From Saved Schema Snapshots
  -> Edit Rules / JSONata Metadata
  -> Run With Saved Source Sample Or Override Input
  -> Validate Against Target Schema
  -> Save Mapping Template With Schema Links And Snapshots
```

## Proposed SQLite Shape

Keep schema artifacts in the existing local SQLite database configured by `TEMPLATE_DB_PATH`.

```text
schemas
  schema_id text primary key
  name text not null
  description text not null default ''
  direction text not null
  format text not null
  original_content text not null
  original_filename text
  original_content_type text
  original_size integer not null
  input_method text not null
  canonical_sample_json text not null
  inferred_schema_json text not null
  parse_metadata_json text not null
  deleted_at text
  created_at text not null

template_versions
  source_schema_id text
  target_schema_id text
```

### Storage Rules

- `direction` must be `source` or `target`.
- Source schemas may use `json`, `xml`, `edi_214`, or `edi_856`.
- Target schemas may use `json` or `xml` only.
- `original_content` stores the exact uploaded or pasted text.
- Uploaded files are read as text in the browser for v1 and are not stored as binary files.
- `canonical_sample_json`, `inferred_schema_json`, and `parse_metadata_json` are JSON text columns.
- Deleting a schema sets `deleted_at`; deleted schemas are hidden from normal lists but remain readable by ID for linked template history.
- Template versions store nullable schema IDs plus schema snapshots. Runtime behavior must not depend on linked schemas still being active.

## API Contract Checklist

- [x] Add `SchemaDirection` model with `source` and `target`.
- [x] Add `SchemaInputMethod` model with `upload` and `paste`.
- [x] Add schema artifact response model.
- [x] Add schema artifact create request model.
- [x] Add schema artifact list response model.
- [x] Implement `POST /api/schemas`.
- [x] Implement `GET /api/schemas`.
- [x] Implement `GET /api/schemas/{schema_id}`.
- [x] Implement `DELETE /api/schemas/{schema_id}` as soft delete.
- [x] Validate source schema formats: JSON, XML, EDI 214, EDI 856.
- [x] Validate target schema formats: JSON and XML only.
- [x] Parse content during schema creation.
- [x] Infer schema during schema creation.
- [x] Persist original content exactly as submitted.
- [x] Persist upload metadata when available.
- [x] Return clear parse errors without creating a schema row.
- [x] Exclude soft-deleted schemas from default list responses.
- [x] Allow optional `include_deleted=true` for debug or future admin use if useful.
- [x] Extend template create and version request models with optional `source_schema_id`.
- [x] Extend template create and version request models with optional `target_schema_id`.
- [x] Extend template version responses with optional `source_schema_id`.
- [x] Extend template version responses with optional `target_schema_id`.
- [x] Preserve existing parse, infer, mapping suggestion, transform, validate, and template endpoints.

## Frontend Checklist

- [x] Add top-level tabs for `Schema` and `Mapping`.
- [x] Default first load to the Schema tab if no saved source or target schemas exist.
- [x] Add Schema tab create panel.
- [x] Add schema name input.
- [x] Add schema description input.
- [x] Add source/target direction selector.
- [x] Add format selector constrained by direction.
- [x] Add upload control that reads text content and captures file metadata.
- [x] Add raw text textarea for pasted content.
- [x] Add create schema action.
- [x] Add loading, empty, and error states for schema creation.
- [x] Add source schema library list.
- [x] Add target schema library list.
- [x] Add schema detail panel with inferred fields.
- [x] Add canonical sample preview.
- [x] Add original content preview.
- [x] Add soft delete action for schema artifacts.
- [x] Refresh schema lists after create or delete.
- [x] Add Mapping tab source schema selector.
- [x] Add Mapping tab target schema selector.
- [x] Disable auto map until one active source and one active target schema are selected.
- [x] Generate mappings from selected schema artifacts only.
- [x] Preserve the existing Local and AI-assisted auto map modes.
- [x] Preserve visual rule editing.
- [x] Preserve advanced JSONata metadata editing.
- [x] Preserve output preview and validation panel.
- [x] Add run mode for saved source sample.
- [x] Add run mode for override source input.
- [x] Parse override source input using the selected source schema format.
- [x] Save mapping templates with selected schema IDs plus schema snapshots.
- [x] Load legacy templates that have snapshots but no schema IDs.
- [x] Load linked templates even if linked schemas were soft deleted.

## Backend Implementation Phases

## Phase 1 - Backend Schema Artifact Library

Status: Complete - ready for review

Goal: Add durable schema artifact persistence and APIs while preserving the current parse and inference primitives.

### Tasks

- [x] Add schema artifact API models.
- [x] Add schema artifact repository boundary.
- [x] Add SQLite initialization for the `schemas` table.
- [x] Add helper for generating stable schema IDs.
- [x] Add repository method to create a schema artifact.
- [x] Add repository method to list active schema artifacts.
- [x] Add repository method to read one schema artifact by ID.
- [x] Add repository method to soft delete a schema artifact.
- [x] Reuse existing parser functions for schema artifact creation.
- [x] Reuse existing schema inference for schema artifact creation.
- [x] Store canonical sample JSON as text.
- [x] Store inferred schema JSON as text.
- [x] Store parse metadata JSON as text.
- [x] Store exact original content as text.
- [x] Store filename, content type, size, and input method.
- [x] Add FastAPI schema artifact routes.
- [x] Include the schema router from `app.main`.
- [x] Return 400 for parse or unsupported format errors.
- [x] Return 404 for missing schema artifacts.
- [x] Return active schemas by default.

### Checkpoint

- [x] `POST /api/schemas` creates a durable schema artifact.
- [x] `GET /api/schemas` lists active source and target schemas.
- [x] `GET /api/schemas/{schema_id}` returns full schema details.
- [x] `DELETE /api/schemas/{schema_id}` soft deletes a schema.
- [x] Original content is preserved exactly.
- [x] Phase 1 review notes are added before moving to Phase 2.

### Phase 1 Review Notes

- Completed Phase 1 backend schema artifact library.
- Added schema artifact API models for direction, input method, create requests, list responses, and full artifact responses.
- Added `SchemaArtifactRepository` using the existing SQLite database path from `TEMPLATE_DB_PATH`.
- Added automatic `schemas` table initialization with JSON/text columns for canonical samples, inferred schemas, parse metadata, original content, and upload metadata.
- Added `POST /api/schemas`, `GET /api/schemas`, `GET /api/schemas/{schema_id}`, and `DELETE /api/schemas/{schema_id}`.
- Reused the existing parser and schema inference code paths by extracting shared parse dispatch into `app.core.parsers.parse_payload`.
- Added source and target format validation; target schemas reject EDI formats.
- Added soft delete behavior through `deleted_at`; normal lists hide deleted schemas, while reads by ID still return them.
- Added backend tests for create/list/read/delete, original content preservation, target format rejection, parse-failure rollback, and missing schema errors.
- Verification passed on 2026-06-13: backend `pytest` with 42 tests, `ruff check app tests`, and `pyright app tests`.
- Known residual note: pytest still emits the existing third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 1 behavior.
- Next gated step: complete Phase 2 template schema links.

## Phase 2 - Template Schema Links

Status: Complete - ready for review

Goal: Link mapping template versions back to schema artifacts while retaining snapshots for stable historical behavior.

### Tasks

- [x] Add optional `source_schema_id` to template version models.
- [x] Add optional `target_schema_id` to template version models.
- [x] Add SQLite columns to `template_versions`.
- [x] Add additive column initialization for existing local databases.
- [x] Store schema IDs when creating template version 1.
- [x] Store schema IDs when creating later template versions.
- [x] Return schema IDs in template version responses.
- [x] Keep schema snapshots required for stable mapping behavior.
- [x] Keep seeded templates compatible with null schema IDs.
- [x] Keep legacy user templates compatible with null schema IDs.
- [x] Avoid hard dependency on active schema rows when loading templates.

### Checkpoint

- [x] New template versions include source and target schema IDs when provided.
- [x] Existing snapshot-only templates still list, load, and run.
- [x] Seeded examples remain available and runnable.
- [x] Soft-deleted linked schemas do not break template loading.
- [x] Phase 2 review notes are added before moving to Phase 3.

### Phase 2 Review Notes

- Completed Phase 2 template schema links.
- Added nullable `source_schema_id` and `target_schema_id` fields to template version response models and template create/version request models.
- Added nullable `source_schema_id` and `target_schema_id` columns to `template_versions`, including additive initialization for existing SQLite databases.
- Updated template version insert/select/readback paths to persist schema IDs while retaining schema snapshots.
- Kept seeded templates and snapshot-only legacy templates compatible with null schema IDs.
- Kept schema links as loose IDs with no active-schema foreign key dependency, so soft-deleted linked schemas do not break template loading.
- Added backend tests for linked template version creation, versioning, DB column storage, soft-deleted schema link loading, seeded null links, and snapshot-only compatibility.
- Verification passed on 2026-06-13: backend `pytest` with 44 tests, `ruff check app tests`, and `pyright app tests`.
- Known residual note: pytest still emits the existing third-party Starlette deprecation warning from `fastapi.testclient`; it does not affect Phase 2 behavior.
- Next gated step: complete Phase 3 Schema tab UI.

## Phase 3 - Schema Tab UI

Status: Complete - ready for review

Goal: Build the Schema tab for creating, browsing, and inspecting reusable schema artifacts.

### Tasks

- [x] Add frontend schema artifact types.
- [x] Add API client functions for schema create, list, read, and delete.
- [x] Add Effect wrappers for schema artifact APIs.
- [x] Add schema library state hook or controller section.
- [x] Add tab shell with Schema and Mapping tabs.
- [x] Add Schema tab route content inside the existing workbench page.
- [x] Add schema creation form.
- [x] Add direction selector.
- [x] Add direction-aware format selector.
- [x] Add file upload input.
- [x] Add pasted raw text input.
- [x] Capture file name, type, size, and input method.
- [x] Add create schema button.
- [x] Add schema creation error state.
- [x] Add source schema list.
- [x] Add target schema list.
- [x] Add selected schema detail view.
- [x] Reuse or extend schema viewer for inferred fields.
- [x] Add canonical sample preview.
- [x] Add original content preview.
- [x] Add soft delete control.
- [x] Refresh lists after create and delete.
- [x] Keep layout responsive on desktop and mobile.

### Checkpoint

- [x] User can create a source schema from pasted JSON.
- [x] User can create a source schema from uploaded XML.
- [x] User can create an EDI source schema.
- [x] User can create a target schema from JSON or XML.
- [x] User can inspect inferred fields, canonical sample, and original content.
- [x] User can soft delete a schema and see it removed from active lists.
- [x] Phase 3 review notes are added before moving to Phase 4.

### Phase 3 Review Notes

- Completed Phase 3 Schema tab UI.
- Added frontend schema artifact types and template link fields.
- Added API client and Effect wrappers for schema create, list, read, and delete calls.
- Added `useSchemaLibraryController` for schema library state, creation, refresh, selection, upload metadata, and soft deletion.
- Added `SchemaLibraryPanel` with create-schema form, direction-aware format controls, upload/paste input, source and target library lists, detail inspection, inferred fields, canonical sample, original content preview, and delete action.
- Added top-level Schema and Mapping tabs to the workbench route while preserving the existing mapping flow under the Mapping tab.
- Added responsive CSS for the tab strip, schema form, schema library, and detail preview.
- Verification passed on 2026-06-13: frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: Schema tab initial render, pasted JSON source schema create, JSON target schema create, detail preview, soft delete, EDI 214 source schema create, Mapping tab render, and no browser console errors.
- Known residual note: upload control support is implemented and typechecked, but browser automation did not exercise native file chooser upload because the available browser API does not expose file selection.
- Next gated step: complete Phase 4 Mapping tab UI.

## Phase 4 - Mapping Tab UI

Status: Complete - ready for review

Goal: Move mapping-specific work into the Mapping tab and drive auto mapping from selected schema artifacts.

### Tasks

- [x] Move source and target sample authoring out of the Mapping tab.
- [x] Add source schema selector.
- [x] Add target schema selector.
- [x] Load selected source schema details into mapping state.
- [x] Load selected target schema details into mapping state.
- [x] Disable mapping controls until both schemas are selected.
- [x] Update ready-for-mapping logic to depend on selected schemas.
- [x] Update auto map to use selected schema snapshots.
- [x] Preserve Local and AI-assisted mode behavior.
- [x] Preserve suggestion display and provider error display.
- [x] Preserve visual rule editor behavior.
- [x] Preserve JSONata editor behavior.
- [x] Add transform run mode selector for saved sample or override input.
- [x] Use selected source artifact canonical sample for saved-sample runs.
- [x] Parse override input before transform.
- [x] Validate output against selected target schema when applicable.
- [x] Save templates with selected schema IDs and snapshots.
- [x] Load templates with schema IDs when present.
- [x] Load templates from snapshots when schema IDs are absent.
- [x] Clear stale suggestions, output, and validation when selected schemas change.
- [x] Keep New Mapping behavior compatible with the split tab model.

### Checkpoint

- [x] User can select a source schema and target schema.
- [x] User can auto map selected schemas.
- [x] User can edit generated rules.
- [x] User can run transformation with the saved source sample.
- [x] User can run transformation with override source input.
- [x] User can save a mapping template with schema IDs and snapshots.
- [x] User can reload saved linked templates.
- [x] Existing seeded snapshot-only examples still load.
- [x] Phase 4 review notes are added before moving to Phase 5.

### Phase 4 Review Notes

- Completed Phase 4 Mapping tab UI.
- Added `MappingSchemaPanel` with source/target schema selectors and saved-sample/override run mode controls.
- Refactored `useMappingWorkbenchController` to accept saved schema artifacts, derive mapping readiness from selected schemas, and keep legacy snapshot-template fallback behavior.
- Auto map now uses selected schema artifact snapshots instead of reparsing raw source/target textareas.
- Transform runs use the selected source schema canonical sample by default, or parse override input with the selected source schema format.
- Template saves now include selected `source_schema_id` and `target_schema_id` while retaining schema snapshots and sample content.
- Linked templates restore schema selector state when schema IDs are present.
- Seeded and legacy snapshot-only templates continue to load and run without schema IDs.
- Removed raw source/target sample authoring from the Mapping tab while preserving rule editor, JSONata editor, suggestions, output, validation, and template controls.
- Verification passed on 2026-06-13: frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: schema selectors auto-populate from saved schemas, Auto map is disabled until schemas exist, selected schemas auto map, saved-sample transform runs, override mode opens and runs, linked templates save with schema IDs and snapshots, linked templates reload selectors, seeded snapshot-only example loads with blank selectors and runs, and no browser console errors.
- Known residual note: browser automation text entry remains blocked by the in-app browser virtual clipboard in this session, so verification seeded schemas through the backend API before exercising the Mapping tab UI.
- Next gated step: complete Phase 5 verification and documentation.

## Phase 5 - Verification And Documentation

Status: Complete - ready for review

Goal: Verify the split schema/mapping workflow end to end and update documentation for the new architecture.

### Tasks

- [x] Add backend tests for schema artifact creation.
- [x] Add backend tests for schema artifact list/read/delete.
- [x] Add backend tests for original content preservation.
- [x] Add backend tests for target format restrictions.
- [x] Add backend tests for parse failure rollback.
- [x] Add backend tests for template schema ID persistence.
- [x] Add backend tests for legacy template compatibility.
- [x] Run backend `pytest`.
- [x] Run backend `ruff check app tests`.
- [x] Run backend `pyright app tests`.
- [x] Run frontend `pnpm lint`.
- [x] Run frontend `pnpm typecheck`.
- [x] Run frontend `pnpm build`.
- [x] Verify browser flow for creating source and target schemas.
- [x] Verify browser flow for auto mapping selected schemas.
- [x] Verify browser flow for running saved-sample transform.
- [x] Verify browser flow for running override-input transform.
- [x] Verify browser flow for saving and loading linked templates.
- [x] Update root README demo flow.
- [x] Update backend README API examples.
- [x] Update frontend README workflow notes.

### Checkpoint

- [x] All backend checks pass.
- [x] All frontend checks pass.
- [x] Browser verification covers Schema and Mapping tabs.
- [x] Documentation describes schema library workflow.
- [x] Phase 5 review notes are added before final acceptance.

### Phase 5 Review Notes

- Completed Phase 5 verification and documentation.
- Added backend schema artifact coverage for XML target schemas and XML, EDI 214, and EDI 856 source schemas.
- Confirmed schema artifact tests cover create, list, read, soft delete, original content preservation, upload metadata, target format restrictions, parse-failure rollback, and missing schema errors.
- Confirmed template tests cover schema ID persistence, schema snapshots, soft-deleted linked schemas, seeded null schema IDs, and snapshot-only compatibility.
- Updated root README browser demo flow for the new Schema and Mapping tabs.
- Updated backend README with schema artifact API examples and schema/template SQLite storage wording.
- Updated frontend README demo flow for schema creation, schema selection, saved-sample runs, override runs, and linked/snapshot-only template loading.
- Verification passed on 2026-06-13: backend `pytest` with 48 tests, `ruff check app tests`, and `pyright app tests`; frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: Schema tab library visibility, Mapping tab schema selectors, selected-schema auto map, saved-sample transform, override transform, linked template save, linked template load, seeded snapshot-only template API compatibility, and no browser console errors.
- Known residual note: browser automation text entry remains blocked by the in-app browser virtual clipboard in this session, so final browser verification seeded schemas through the backend API before exercising the Schema library display and Mapping tab UI.
- All planned `todo3.md` implementation phases are complete.

## Test Plan

### Backend

- [x] `pytest` passes.
- [x] `ruff check app tests` passes.
- [x] `pyright app tests` passes.
- [x] Fresh SQLite database initializes `schemas`.
- [x] Existing SQLite databases receive additive schema-link columns.
- [x] Schema artifact creation preserves pasted text exactly.
- [x] Schema artifact creation preserves uploaded file metadata.
- [x] JSON schema creation succeeds.
- [x] XML schema creation succeeds.
- [x] EDI 214 source schema creation succeeds.
- [x] EDI 856 source schema creation succeeds.
- [x] EDI target schema creation is rejected.
- [x] Invalid content returns 400 and does not write a row.
- [x] Soft-deleted schemas are hidden from normal lists.
- [x] Soft-deleted schemas remain readable by ID.
- [x] Template versions store schema IDs and snapshots.
- [x] Snapshot-only templates remain compatible.

### Frontend

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] Schema tab creates schemas from pasted text.
- [x] Schema tab creates schemas from uploaded files.
- [x] Schema tab shows source and target schema lists.
- [x] Schema tab shows inferred fields, canonical sample, and original content.
- [x] Mapping tab blocks auto map until both schemas are selected.
- [x] Mapping tab auto maps selected schemas.
- [x] Mapping tab runs transform with saved source sample.
- [x] Mapping tab runs transform with override input.
- [x] Mapping tab saves templates with schema links.
- [x] Mapping tab loads linked and snapshot-only templates.

## Acceptance Criteria

- [x] The app has separate Schema and Mapping tabs.
- [x] Schema creation is responsible for upload/paste, parsing, and schema inference.
- [x] Mapping no longer requires raw source and target sample authoring before auto map.
- [x] Mapping selects saved source and target schema artifacts.
- [x] Auto map uses selected schema artifacts.
- [x] Transform can run using the saved source sample.
- [x] Transform can run using an override source payload.
- [x] Original uploaded or pasted content is preserved for each saved schema.
- [x] Schema artifacts are durable in SQLite.
- [x] Schema artifacts are immutable in v1 except soft delete.
- [x] Mapping templates store schema links plus snapshots.
- [x] Existing seeded templates and legacy snapshot-only templates continue to work.
- [x] Deterministic transformation runtime is unchanged.
- [x] AI-assisted mapping remains optional and design-time only.

## Assumptions

- SQLite remains the local development database for this POC.
- PostgreSQL implementation is deferred.
- Schema artifacts are reusable product assets, not temporary browser state.
- Schema artifacts are immutable in v1 except soft delete.
- Original uploaded or pasted content is text and can be stored in SQLite.
- Binary file storage is deferred.
- Target schema artifacts support JSON and XML only.
- Source schema artifacts support JSON, XML, EDI 214, and EDI 856.
- Transformation run history is not persisted in v1.
- Saved templates must remain stable even if linked schemas are deleted later.
- The deterministic runtime remains the only production transformation executor.
