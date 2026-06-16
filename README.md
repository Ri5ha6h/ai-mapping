# Auto Mapping SaaS POC

This repository contains a local proof of concept for mapping inbound JSON, XML,
EDI 214, and EDI 856 payloads into JSON or XML outputs.

The backend owns parsing, schema artifact persistence, schema inference, mapping
suggestions, deterministic transformation, validation, and template versioning.
The frontend is a TanStack Start workbench that calls the FastAPI backend directly.

## Local Startup

Start the backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```bash
cd frontend
pnpm dev --host 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`.

## Fresh Setup

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

Frontend:

```bash
cd frontend
pnpm install
```

## Checks

Backend:

```bash
cd backend
.venv/bin/pytest
.venv/bin/ruff check app tests
.venv/bin/pyright app tests
```

Frontend:

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm build
```

## Demo Scripts

Run the backend first, then from another terminal:

```bash
backend/scripts/demo_json_to_json.sh
backend/scripts/demo_xml_to_json.sh
backend/scripts/demo_json_to_xml.sh
backend/scripts/demo_edi_214.sh
backend/scripts/demo_edi_856.sh
```

Set `API_BASE_URL` if the backend is not on `http://127.0.0.1:8000`.

## Browser Demo Flow

1. Open the `Schema` tab.
2. Create a source schema from pasted text or an uploaded file.
3. Create a target schema from pasted JSON/XML or an uploaded file.
4. Open the `Mapping` tab.
5. Select the saved source and target schemas.
6. Click `Auto map`.
7. Review or edit rules and JSONata metadata.
8. Click `Run` using the saved source sample or switch to override input.
9. Save the mapping template.
10. Load a linked saved template or seeded snapshot-only example.

Runtime schema and template data is written to `backend/data/templates.sqlite3`
by default and is ignored by Git. Override it with `TEMPLATE_DB_PATH` for
isolated demos; relative paths are resolved from the backend directory. The
backend initializes this database automatically and seeds example script
templates.
