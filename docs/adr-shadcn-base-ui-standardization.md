# ADR: Standardize Frontend UI on shadcn/ui and Base UI

Status: Accepted

Date: 2026-07-09

## Context

The frontend was scaffolded with shadcn/ui, Base UI primitives, Tailwind CSS, and lucide icons, but the workbench had drifted toward a large custom component stylesheet. That made common UI behaviors such as tabs, dialogs, selects, segmented controls, cards, alerts, and validation rows harder to keep consistent.

## Decision

Use shadcn/ui components as the default UI surface for reusable controls and panel chrome. Keep Base UI as the accessible primitive layer through the generated shadcn components. Keep custom CSS only for app-level layout, Monaco/editor sizing, code previews, scrollable pre blocks, responsive workbench grids, theme tokens, and global base styles.

Project-specific composition should happen in small wrappers, not in global component CSS. The current wrappers are:

- `WorkbenchCard` for workbench panels.
- `PanelHeader` for kicker/title/action layout.
- `Field` for label/control/helper layout.
- `SegmentedControl` for two-or-more mutually exclusive modes.
- `StatusAlert` and `StatusBadge` for status copy.
- `SelectField` for labeled shadcn select controls.

## Consequences

- New interactive UI should start from `frontend/src/components/ui/*` and only add wrappers when a pattern repeats.
- Components should not add new global component selectors for buttons, selects, cards, alerts, tabs, dialogs, or segmented controls.
- `frontend/src/styles.css` should stay focused on tokens, base rules, layout grids, editor frames, and code preview behavior.
- Tests should assert visible behavior and accessible roles rather than custom class names.

## Verification

Frontend verification for this migration should include:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
