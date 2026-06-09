# Auto Mapping Frontend

TanStack Start workbench for the Auto Mapping SaaS POC.

The frontend calls the FastAPI backend directly through `VITE_API_BASE_URL`.
No product/domain API is implemented with TanStack server functions.

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

1. Choose a scenario from the demo scenario strip.
2. Click `Parse` to canonicalize input and infer schemas.
3. Click `Auto map` to generate candidate rules.
4. Edit rules or JSONata metadata if needed.
5. Click `Run` to execute deterministic backend transformation.
6. Save a template and create a new version from the template panel.
