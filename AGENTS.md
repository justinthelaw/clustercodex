# AGENTS.md

## Purpose

- Cluster Codex is a local-first platform engineering assistant for Kubernetes troubleshooting.
- Scope includes frontend (`frontend/`), backend (`backend/`), infra scripts (`scripts/`), and Helm assets (`charts/`).

## Repository Map

- `README.md`: product overview, architecture, and workflow.
- `DEVELOPMENT.md`: local setup and development workflow.
- `frontend/`: React + Vite application.
- `backend/`: Express + TypeScript API.
- `scripts/`: infrastructure and E2E orchestration scripts.
- `charts/`: Helm resources for ancillary cluster components.
- `tests/`: Playwright E2E coverage.

## Development Notes

- Treat `README.md` and `DEVELOPMENT.md` as the source of truth for architecture and execution workflow.
- Keep changes scoped and phase-aligned.
- Do not commit secrets or environment-specific credentials.
- Keep cluster-impacting changes explicit and reviewable.

## Validation

- `pre-commit run --all-files`
- `npm --prefix backend run build`
- `npm --prefix frontend run build`
- `npm run test:e2e` for E2E-impacting changes
