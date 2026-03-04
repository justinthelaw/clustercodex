# AGENTS.md

## Purpose

- Cluster Codex is a local-first platform engineering assistant for Kubernetes troubleshooting.
- Scope includes a single frontend application (`src/`), infra scripts (`scripts/`), Helm assets (`charts/`), and E2E tests (`tests/`).

## Repository Map

- `README.md`: product overview, architecture, and workflow.
- `DEVELOPMENT.md`: local setup and development workflow.
- `src/`: root Next.js React application (App Router + client components).
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
- `npm run build`
- `npm run test` for E2E-impacting changes
- `npm run flight-check` for the full local CI-equivalent gate
