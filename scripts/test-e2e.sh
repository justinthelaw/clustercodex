#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export CODEX_MOCK_MODE="${CODEX_MOCK_MODE:-true}"
export NODE_ENV="${NODE_ENV:-test}"
export JWT_SECRET="${JWT_SECRET:-clustercodex-e2e-jwt-secret}"

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-90}"

  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "${name} did not become ready at ${url}" >&2
  return 1
}

wait_for_login() {
  local attempts="${1:-90}"
  local payload='{"email":"admin@clustercodex.local","password":"admin123!"}'

  for _ in $(seq 1 "${attempts}"); do
    local status
    status="$(curl -sS -o /tmp/clustercodex-auth-smoke.json -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -d "${payload}" \
      http://localhost:3001/api/auth/login || true)"

    if [[ "${status}" == "200" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "Backend auth login smoke test failed. Last response:" >&2
  cat /tmp/clustercodex-auth-smoke.json >&2 || true
  return 1
}

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
  CODEX_MOCK_MODE="${CODEX_MOCK_MODE}" JWT_SECRET="${JWT_SECRET}" npm run dev
) >/tmp/clustercodex-backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting frontend..."
(
  cd "${ROOT_DIR}/frontend"
  npm run dev -- --host 127.0.0.1 --port 5173
) >/tmp/clustercodex-frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for services..."
wait_for_url "Backend health endpoint" "http://localhost:3001/health"
wait_for_login
wait_for_url "Frontend app" "http://localhost:5173"

echo "Running Playwright tests..."
npx playwright test
