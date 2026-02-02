#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export CODEX_MOCK_MODE="${CODEX_MOCK_MODE:-true}"
export NODE_ENV="${NODE_ENV:-test}"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "Starting backend (mock mode)..."
(
  cd "${ROOT_DIR}/backend"
  CODEX_MOCK_MODE="${CODEX_MOCK_MODE}" npm run dev
) >/tmp/clustercodex-backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting frontend..."
(
  cd "${ROOT_DIR}/frontend"
  npm run dev -- --host 127.0.0.1 --port 5173
) >/tmp/clustercodex-frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for services..."
until curl -sf http://localhost:3001/health >/dev/null; do sleep 1; done
until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done

echo "Running Playwright tests..."
npx playwright test
