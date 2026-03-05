#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

cleanup() {
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "Starting frontend..."
(
  cd "${ROOT_DIR}"
  CLUSTERCODEX_E2E_MODE=1 NEXT_PUBLIC_CLUSTERCODEX_E2E_MODE=1 \
    npm run dev -- --hostname 127.0.0.1 --port 3000
) >/tmp/clustercodex-frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for frontend app..."
wait_for_url "Frontend app" "http://127.0.0.1:3000"

echo "Running Playwright tests..."
cd "${ROOT_DIR}"
CLUSTERCODEX_E2E_MODE=1 NEXT_PUBLIC_CLUSTERCODEX_E2E_MODE=1 npx playwright test
