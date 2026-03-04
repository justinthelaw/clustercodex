# Contributing

Thanks for contributing to Cluster Codex.

## Ground Rules

- Keep pull requests focused and reviewable.
- Update docs when behavior or workflows change.
- Keep security-sensitive details out of public issues.
- Prefer incremental changes over large refactors.

## Development Setup

Follow the full setup guide in `DEVELOPMENT.md`.

Quick commands:

```bash
npm install
npm run infra:start
npm run dev
```

## Validation

Run these checks before pushing:

```bash
pre-commit run --all-files
npm --prefix backend run build
npm --prefix frontend run build
```

For E2E changes, run:

```bash
npm run test:e2e
```

## Pre-commit

Install hooks once per clone:

```bash
pre-commit install --hook-type pre-commit --hook-type pre-push
```

## Pull Request Expectations

- Describe what changed and why.
- Include local validation commands/results.
- Link issues using `Fixes #<id>` when relevant.
- Include screenshots for UI-impacting changes.
