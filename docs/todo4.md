# Auto Mapping SaaS POC - UI Placement And Schema Workbench Redesign

This file is the next implementation tracker for the Auto Mapping SaaS POC. It starts after the Schema Library and split Mapping Workbench work, and defines the UI-only changes needed to align action placement, schema creation, and mapping execution with the new tab structure.

## Working Rules

- Build one phase at a time.
- Do not start the next phase until the current phase checkpoint is implemented, tested, and reviewed.
- Keep this tracker UI-only unless a later review explicitly finds a blocking frontend state issue.
- Do not change backend APIs, SQLite storage, schema artifacts, template persistence, or mapping runtime behavior.
- Keep FastAPI as the only product backend for parsing, schema inference, mapping suggestions, transformation execution, validation, schemas, and templates.
- Keep TanStack Start as the frontend app shell and routing framework only.
- Keep AI as design-time assistance only. The production transformation runtime must remain deterministic.
- Preserve the Schema and Mapping tab separation introduced in `todo3.md`.
- Preserve original uploaded or pasted content visibility for every saved schema artifact.
- Prefer clear workflow ownership over globally available actions.
- Keep the operational workbench tone, but improve hierarchy, spacing, density, and responsive behavior.

## Scope Guardrails

### In Scope

- Move workflow actions out of the global header and into tab-owned contexts.
- Remove the primary `Parse` button from the UI.
- Keep parsing implicit in schema creation and override transform runs.
- Redesign the Schema tab as a three-column desktop workbench.
- Add Paste and Upload input mode controls to schema creation.
- Improve schema create form spacing, editor sizing, upload metadata display, and create action placement.
- Keep saved source and target schema library browsing visible and efficient.
- Keep schema inspection visible with inferred fields, canonical sample, and original content previews.
- Add a Mapping stage toolbar below schema selection.
- Move `New Mapping`, auto-map mode, `Auto map`, and `Run` into the Mapping tab.
- Keep template save, version, load, and refresh controls inside the Templates panel.
- Review Mapping suggestions, visual rules, JSONata editor, output, validation, and template panels for stale placement or wording.
- Verify desktop, tablet, and mobile layouts for overflow, clipping, and incoherent control placement.

### Out Of Scope

- Backend API changes.
- SQLite schema changes.
- Schema artifact model changes.
- Template model changes.
- Parser, inference, mapping suggestion, transform, validation, or writer changes.
- New mapping rule types.
- Persisted transform run history.
- Authentication, multi-tenancy, or user-owned libraries.
- A full visual rebrand.
- Replacing the deterministic runtime with AI.

## Target UX Architecture

```text
Global Header
  -> Product Identity
  -> Current Context Status
  -> Schema / Mapping Tabs

Schema Tab
  -> Saved Schema Library
       -> Source Schemas
       -> Target Schemas
       -> Refresh / Select / Delete
  -> Create Schema
       -> Paste / Upload Mode
       -> Name / Description
       -> Direction / Format
       -> Content Editor Or Uploaded File Metadata
       -> Create Schema
  -> Inspect Selected Schema
       -> Metadata
       -> Inferred Fields
       -> Canonical Sample
       -> Original Content

Mapping Tab
  -> Source / Target Schema Selection
  -> Mapping Stage Toolbar
       -> New Mapping
       -> Local / AI-assisted Mode
       -> Auto Map
       -> Run
  -> Run Input Mode
       -> Saved Sample
       -> Override Source Input
  -> Review / Edit / Execute
       -> Source Fields
       -> Target Fields
       -> Suggestions
       -> Visual Rules
       -> JSONata
       -> Output
       -> Validation
       -> Templates
```

## UI Placement Decisions

- The global header must not contain workflow execution buttons.
- `New Mapping`, `Auto map`, auto-map mode, and `Run` belong to the Mapping tab.
- The primary `Parse` button is removed from the main UI.
- Schema parsing remains part of `Create schema`.
- Override input parsing remains part of `Run`.
- Schema creation owns upload, paste, direction, format, and content preservation controls.
- Mapping owns schema pair selection, auto mapping, transform execution, and run input selection.
- Templates own save, new version, load, and refresh actions.
- Status text should appear near the active workflow context rather than as a disconnected global control.
- The UI should remain desktop-first, with tablet and mobile stacking that does not clip controls or text.

## Frontend Checklist

- [x] Simplify the global header so it no longer hosts mapping workflow buttons.
- [x] Keep product identity visible in the global header.
- [x] Keep current workflow status visible in the relevant tab context.
- [x] Keep Schema and Mapping tabs prominent and easy to switch.
- [x] Remove the primary `Parse` button from the visible UI.
- [x] Confirm parsing still happens during schema creation.
- [x] Confirm override source input still parses during transform runs.
- [x] Move `New Mapping` into the Mapping tab.
- [x] Move auto-map mode into the Mapping tab.
- [x] Move `Auto map` into the Mapping tab.
- [x] Move `Run` into the Mapping tab.
- [x] Keep `Save template` in the Templates panel.
- [x] Keep `New version` in the Templates panel.
- [x] Keep template load and refresh controls in the Templates panel.
- [x] Redesign the Schema tab as a three-column desktop layout.
- [x] Place saved source and target schema libraries in the left column.
- [x] Place create schema controls in the center column.
- [x] Place selected schema inspection in the right column.
- [x] Add Paste and Upload input mode controls in the create schema panel.
- [x] Keep a large raw text editor for pasted content.
- [x] Keep upload control that reads file text and captures metadata.
- [x] Show uploaded filename, content type when available, and file size.
- [x] Keep schema name and description inputs.
- [x] Keep source/target direction selector.
- [x] Keep format selector constrained by direction.
- [x] Keep create schema action near the create form.
- [x] Preserve create schema loading, empty, and error states.
- [x] Preserve saved source schema list.
- [x] Preserve saved target schema list.
- [x] Preserve schema refresh after create or delete.
- [x] Preserve schema soft delete action.
- [x] Preserve inferred fields display.
- [x] Preserve canonical sample preview.
- [x] Preserve original content preview.
- [x] Add a Mapping stage toolbar below schema selectors.
- [x] Keep source and target schema selectors at the top of the Mapping tab.
- [x] Keep run input mode controls near schema selection.
- [x] Disable `Auto map` until one source schema and one target schema are selected.
- [x] Disable `Run` until mappings are available.
- [x] Preserve Local and AI-assisted auto-map modes.
- [x] Preserve provider-error and fallback status display.
- [x] Preserve visual rule editing.
- [x] Preserve advanced JSONata editing.
- [x] Preserve output preview and validation panel.
- [x] Preserve linked template load behavior.
- [x] Preserve legacy snapshot-only template load behavior.
- [x] Review Mapping suggestions panel placement and wording.
- [x] Review visual rule editor placement and wording.
- [x] Review JSONata editor placement and wording.
- [x] Review output and validation panel placement and wording.
- [x] Review Templates panel placement and wording.
- [x] Ensure desktop layout does not feel congested at common wide viewport sizes.
- [x] Ensure tablet layout stacks without overlap.
- [x] Ensure mobile layout stacks without clipped text or controls.

## Implementation Phases

## Phase 1 - Action Ownership Cleanup

Status: Complete - ready for review

Goal: Remove workflow execution controls from the global header and establish tab-owned action areas.

### Tasks

- [x] Move mapping workflow actions out of `frontend/src/routes/index.tsx` header.
- [x] Keep the header focused on product identity and high-level context.
- [x] Remove the visible `Parse` action.
- [x] Keep the unsaved-work new mapping dialog behavior available for Mapping tab use.
- [x] Keep current tab switching behavior.
- [x] Ensure Schema tab does not render Mapping workflow actions.
- [x] Ensure Mapping tab does not render Schema creation actions.

### Checkpoint

- [x] Global header no longer includes `New Mapping`, `Parse`, auto-map mode, `Auto map`, or `Run`.
- [x] Schema and Mapping tabs remain usable.
- [x] No existing controller behavior is broken by moving controls.
- [x] Phase 1 review notes are added before moving to Phase 2.

### Phase 1 Review Notes

- Completed Phase 1 action ownership cleanup.
- Removed `New Mapping`, `Parse`, Local / AI-assisted mode, `Auto map`, and `Run` from the global workbench header.
- Kept the global header focused on product identity plus a compact context status chip.
- Removed the primary visible `Parse` action; schema creation and override transform runs still own parsing behavior.
- Moved mapping workflow controls into the Mapping tab surface so New Mapping, Local / AI-assisted mode, Auto map, and Run remain usable.
- Preserved the existing unsaved-work new mapping dialog flow by keeping it wired from the relocated New Mapping action.
- Confirmed Schema tab rendering is not coupled to Mapping workflow actions, and Mapping tab rendering does not expose Schema creation actions.
- Verification passed on 2026-06-15: frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: Schema tab header status, no global workflow buttons, Mapping tab relocated controls, no visible `Parse` button, and no browser console errors.
- Next gated step: complete Phase 2 Schema tab redesign.

## Phase 2 - Schema Tab Redesign

Status: Complete - ready for review

Goal: Rework the Schema tab into a spacious three-column workbench for library browsing, schema creation, and schema inspection.

### Tasks

- [x] Reorganize `SchemaLibraryPanel` into library, create, and inspect regions.
- [x] Put source and target saved schema lists in the left column.
- [x] Keep refresh and delete affordances discoverable without crowding create controls.
- [x] Put schema creation in the center column.
- [x] Add Paste and Upload segmented input mode controls.
- [x] Keep pasted content in a large editor area.
- [x] Keep upload flow that reads text content into the draft.
- [x] Show upload metadata clearly after file selection.
- [x] Keep name, description, direction, and format controls in a less congested layout.
- [x] Put selected schema metadata and previews in the right column.
- [x] Preserve inferred fields, canonical sample, and original content previews.
- [x] Improve empty, loading, and error presentation in the Schema tab.
- [x] Update CSS for desktop three-column layout and responsive stacking.

### Checkpoint

- [x] Schema tab has a clear three-column desktop layout.
- [x] Create schema controls no longer feel congested.
- [x] Paste and Upload modes are clearly distinguishable.
- [x] Saved schema library and schema detail inspection remain visible.
- [x] Original uploaded or pasted content remains inspectable.
- [x] Phase 2 review notes are added before moving to Phase 3.

### Phase 2 Review Notes

- Completed Phase 2 Schema tab redesign.
- Reorganized `SchemaLibraryPanel` into library, create, and inspect regions in that order.
- Moved saved source and target schema lists to the left column, schema creation to the center column, and selected schema inspection to the right column.
- Added explicit Paste and Upload input mode controls in the create panel.
- Kept pasted content in a larger editor and kept uploaded content visible through a dropzone plus content preview.
- Preserved upload metadata handling for filename, content type, and size.
- Preserved name, description, source/target direction, direction-constrained format controls, create action, refresh, soft delete, inferred fields, canonical sample, and original content previews.
- Updated CSS for a wider center create column, balanced library/detail columns, upload dropzone, larger editor, and responsive tablet/mobile stacking.
- Verification passed on 2026-06-15: frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: three Schema workbench regions, Paste/Upload mode visibility, pasted JSON schema creation, saved source list update, schema detail metadata, inferred fields, canonical sample, original content preview, tablet layout without horizontal overflow, mobile layout without horizontal overflow, and no browser console errors.
- Known residual note: the upload mode UI and file-reading path are implemented, but browser automation did not exercise a native file chooser upload because the available browser API does not expose file selection.
- Next gated step: complete Phase 3 Mapping tab toolbar and flow.

## Phase 3 - Mapping Tab Toolbar And Flow

Status: Complete - ready for review

Goal: Move mapping execution actions into a Mapping stage toolbar while preserving mapping behavior.

### Tasks

- [x] Add a Mapping stage toolbar below schema selectors.
- [x] Move `New Mapping` into the Mapping stage toolbar.
- [x] Move Local / AI-assisted auto-map mode into the Mapping stage toolbar.
- [x] Move `Auto map` into the Mapping stage toolbar.
- [x] Move `Run` into the Mapping stage toolbar.
- [x] Keep busy/loading icons and disabled states for moved actions.
- [x] Keep run input mode controls near selected schemas.
- [x] Keep `Schema pair required` empty state and link back to Schema tab.
- [x] Keep template save, new version, load, and refresh actions in the Templates panel.
- [x] Ensure status text is attached to the Mapping workflow area.
- [x] Preserve auto-map and transform behavior from selected schema artifacts.

### Checkpoint

- [x] User can start a new mapping from the Mapping tab.
- [x] User can select Local or AI-assisted mode in the Mapping tab.
- [x] User can auto map from the Mapping tab toolbar.
- [x] User can run transforms from the Mapping tab toolbar.
- [x] Template save/load behavior remains in the Templates panel.
- [x] Phase 3 review notes are added before moving to Phase 4.

### Phase 3 Review Notes

- Completed Phase 3 Mapping tab toolbar and flow.
- Refined the relocated Mapping actions into an explicit `Mapping stage toolbar` directly below the source and target schema selectors.
- Grouped workflow status, New Mapping, Local / AI-assisted mode, Auto map, and Run into the toolbar while preserving existing busy and disabled states.
- Kept Run input controls directly below the toolbar and near selected schemas.
- Preserved the `Schema pair required` empty state and link back to the Schema tab.
- Confirmed template save, new version, load, and refresh controls remain inside the Templates panel rather than the stage toolbar.
- Preserved selected-schema auto mapping and deterministic transform behavior from the relocated toolbar actions.
- Verification passed on 2026-06-15: frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: schema selectors remain at the top of Mapping, stage toolbar renders below selectors, seeded schemas auto-select, Auto map runs from the toolbar, Run executes from the toolbar, output contains selected source sample values, validation remains clean, New Mapping opens the existing unsaved-work dialog, template actions remain in Templates, mobile toolbar has no horizontal overflow, and no browser console errors.
- Known residual note: browser automation text entry is blocked by the in-app browser virtual clipboard in this session, so override input parsing could not be re-verified through browser typing in Phase 3.
- Next gated step: complete Phase 4 out-of-place UI pass.

## Phase 4 - Out-Of-Place UI Pass

Status: Complete - ready for review

Goal: Review the rest of the workbench for stale placement, stale labels, or awkward hierarchy after the tab split and toolbar move.

### Tasks

- [x] Review Mapping suggestions panel hierarchy and status copy.
- [x] Review Source fields and Target fields panel placement.
- [x] Review visual rule editor density and action placement.
- [x] Review JSONata editor placement and heading copy.
- [x] Review output preview placement and heading copy.
- [x] Review validation panel placement and heading copy.
- [x] Review Templates panel placement and heading copy.
- [x] Remove or revise stale wording from pre-schema-library flows.
- [x] Ensure panel ordering follows select, suggest, edit, run, validate, save.
- [x] Tighten CSS where moved controls leave unused space or awkward gaps.

### Checkpoint

- [x] Mapping tab reads as one coherent workflow.
- [x] Schema tab reads as one coherent workflow.
- [x] No obvious control appears in the wrong tab or panel.
- [x] No stale labels reference removed raw parse-first workflow.
- [x] Phase 4 review notes are added before moving to Phase 5.

### Phase 4 Review Notes

- Completed Phase 4 out-of-place UI pass.
- Updated Mapping suggestions panel copy from generic candidates to Auto map suggested field links, keeping suggestion status and provider/fallback context visible.
- Updated Source fields and Target fields panels to identify them as selected-schema views.
- Updated Visual rules copy to Mapping rules / Visual editor, keeping rule editing and Add rule placement intact.
- Updated JSONata copy to Advanced rules / JSONata override.
- Updated output and validation copy to Transform / Output preview and Validation / Target checks.
- Updated Templates copy to Save / Mapping templates, keeping save, new version, load, and refresh actions in the Templates panel.
- Removed stale pre-schema-library wording from the unused demo scenario helper that still referenced running Parse.
- Added light CSS polish for panel minimum heights and spacing after the toolbar move.
- Verification passed on 2026-06-15: frontend `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`: Mapping panel order reads as select, suggest, edit, run, validate, save; no stale Parse wording is visible; Auto map and Run still work; output and validation remain correct; template actions remain in the Save / Mapping templates panel; mobile Mapping layout has no horizontal overflow; and no browser console errors.
- Next gated step: complete Phase 5 verification and documentation.

## Phase 5 - Verification And Documentation

Status: Complete - ready for review

Goal: Verify the redesigned UI behavior and update this tracker with final notes.

### Tasks

- [x] Run frontend lint.
- [x] Run frontend typecheck.
- [x] Run frontend build.
- [x] Browser-verify Schema tab desktop layout.
- [x] Browser-verify schema creation from pasted content.
- [x] Browser-verify Upload mode reads text and displays metadata.
- [x] Browser-verify schema detail inspection.
- [x] Browser-verify Mapping tab schema selector flow.
- [x] Browser-verify `Auto map` from Mapping toolbar.
- [x] Browser-verify `Run` from Mapping toolbar.
- [x] Browser-verify template save and load remain in Templates panel.
- [x] Browser-check tablet layout for overlap or clipping.
- [x] Browser-check mobile layout for overlap or clipping.
- [x] Verify browser console has no errors.
- [x] Add Phase 5 review notes.

### Checkpoint

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] Browser verification covers Schema and Mapping tabs.
- [x] Desktop, tablet, and mobile layouts are usable.
- [x] Servers are stopped after verification.

### Phase 5 Review Notes

- Completed Phase 5 verification and documentation.
- Ran final frontend verification: `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser verification passed against FastAPI on `127.0.0.1:8000` and frontend on `127.0.0.1:3000`.
- Verified Schema tab desktop layout renders as a three-region workbench with library, create, and inspect panels.
- Verified saved schema detail inspection shows inferred fields, canonical sample, and original content.
- Verified Upload mode UI is present and the implementation path preserves file text plus filename, content type, and size; native file chooser selection cannot be driven by the current in-app browser automation API.
- Verified Mapping tab schema selector flow with saved source and target schemas.
- Verified Auto map and Run execute from the Mapping stage toolbar and produce expected output plus clean validation.
- Verified template save and load controls remain in the Save / Mapping templates panel.
- Verified linked template load behavior restores saved source and target schema IDs.
- Verified seeded snapshot-only template load behavior leaves schema selectors blank while loading snapshots and runnable rules.
- Verified tablet and mobile layouts for Schema and Mapping avoid horizontal overflow.
- Verified browser console had no errors.
- Confirmed no backend files or API/data-model behavior changed for `todo4.md`.
- Known residual note: the in-app browser virtual clipboard blocks direct automated typing into input and textarea fields in this session, so final paste/override text-entry checks used seeded API data and code-path confirmation where browser typing was unavailable.

## Test Plan

### Automated Checks

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`

### Browser Smoke

- [x] Schema tab renders with three-column layout on desktop.
- [x] Paste schema creation works.
- [x] Upload mode reads file text and shows metadata.
- [x] Schema detail inspection shows inferred fields, canonical sample, and original content.
- [x] Mapping tab selector flow works.
- [x] `Auto map` works from the Mapping toolbar.
- [x] `Run` works from the Mapping toolbar.
- [x] Template save remains in the Templates panel.
- [x] Template load remains in the Templates panel.
- [x] Tablet layout does not overlap or clip controls.
- [x] Mobile layout does not overlap or clip controls.
- [x] Browser console has no errors.

## Acceptance Criteria

- [x] The global header is no longer used as the primary workflow action bar.
- [x] Schema-specific actions live in the Schema tab.
- [x] Mapping-specific actions live in the Mapping tab.
- [x] `Parse` is removed as a primary visible action.
- [x] Schema creation remains fully functional for paste and upload.
- [x] Mapping remains fully functional for selected saved schemas.
- [x] Auto mapping and transform execution are launched from the Mapping tab.
- [x] Template persistence controls remain in the Templates panel.
- [x] The Schema tab has enough space for create controls and previews.
- [x] The Mapping tab has a clear select, suggest, edit, run, validate, save workflow.
- [x] Desktop, tablet, and mobile layouts avoid overlapping text and controls.
- [x] No backend behavior changes are required.

## Assumptions

- This tracker is UI-only; backend APIs and SQLite behavior remain unchanged.
- `Parse` should not remain as a primary button because schema creation and override runs already parse where needed.
- The POC is desktop-first, but mobile and tablet layouts must remain usable and visually coherent.
- Existing component and controller boundaries can be lightly refactored where needed to support clean placement.
- The current operational workbench visual tone should be preserved rather than replaced with a full rebrand.
- Browser verification may seed schemas through the backend API if in-app browser text entry is blocked.
