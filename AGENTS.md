# Agent Instructions

## Project Setup

- Backend package management uses a local Python virtual environment and pip. From `backend/`, install with `python -m pip install -e ".[dev]"` after activating `.venv`.
- Frontend package management uses pnpm. Run frontend install and scripts from `frontend/`.
- Assume the backend and frontend dev servers are already running unless the user explicitly says otherwise.

## Common Checks

- Backend checks are documented in `README.md` and `backend/README.md`.
- Frontend checks are documented in `README.md` and `frontend/README.md`.
- Do not restart or replace running dev servers unless verification requires it or the user asks.
