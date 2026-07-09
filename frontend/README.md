# Auto Mapping Frontend

TanStack Start workbench for the Auto Mapping SaaS POC.

The frontend calls the FastAPI backend directly through `VITE_API_BASE_URL`.
No product/domain API is implemented with TanStack server functions.
The current workbench is script-first: users select schemas, generate field hints,
author a JavaScript `transform(source, helpers)` function, run it through the
backend, and save versioned script templates. See `../docs/architecture-current.md`.

## UI Standards

The frontend uses shadcn/ui components backed by Base UI primitives for reusable
controls and panel chrome. Keep custom CSS limited to theme/base rules, workbench
layout grids, Monaco/editor framing, and code preview overflow behavior.

See `../docs/adr-shadcn-base-ui-standardization.md` and `../docs/ui-glossary.md`.

## Install

```bash
cd frontend
pnpm install
```

## Run

Start the backend first on `http://127.0.0.1:8000`, then run:

```bash
cd frontend
pnpm dev --host 127.0.0.1 --port 3000
```

Override the API base URL when needed:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000 pnpm dev --host 127.0.0.1 --port 3000
```

## Checks

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm build
```

## Demo Flow

1. Open the `Schema` tab.
2. Create a source schema from pasted text or uploaded content.
3. Create a target schema from pasted JSON/XML or uploaded content.
4. Open the `Mapping` tab.
5. Select the saved source and target schemas.
6. Generate field hints and a JavaScript transform draft.
7. Edit the JavaScript transform function if needed.
8. Click `Run` with the saved source sample, or switch to override input.
9. Save a template and create a new version from the template panel.
10. Load saved linked templates or seeded snapshot-only examples from the template panel.
