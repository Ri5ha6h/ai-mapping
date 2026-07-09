# ADR: Use Manifest Table Visual System For Frontend Workbench

Status: Accepted

Date: 2026-07-09

## Context

The workbench is a local integration mapping console for schema samples, JavaScript transforms, validation output, and saved templates. The previous visual system was functional but generic: neutral cards, a simple grid background, and limited connection to logistics-style payload mapping.

## Decision

Use a manifest table visual system for the frontend workbench. Keep the existing Schema and Mapping workflow, shadcn/ui component base, and compact operational density, but style the shell as a logistics control surface with route-grid texture, waybill-like labels, crisp panel boundaries, ink/teal base colors, and amber signal states.

## Consequences

- UI changes should preserve the existing tab and stage workflow unless a separate product decision changes it.
- New workbench panels should use the shared manifest panel treatment instead of bespoke card chrome.
- Custom CSS should remain concentrated in theme tokens, layout grids, editor/code frames, and manifest-specific surface treatment.
