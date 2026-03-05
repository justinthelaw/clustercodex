#!/usr/bin/env bash
# Removes generated artifacts, dependencies, and local runtime residue.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "Cleaning build and test artifacts..."

paths=(
  ".env"
  ".next"
  "out"
  "dist"
  "build"
  "coverage"
  "test-results"
  "playwright-report"
  "blob-report"
  "playwright/.cache"
  ".cache"
  "node_modules"
)

for path in "${paths[@]}"; do
  if [[ -e "${path}" ]]; then
    rm -rf "${path}"
  fi
done

files=(
  "test-results.json"
  ".eslintcache"
)

for file in "${files[@]}"; do
  if [[ -e "${file}" ]]; then
    rm -f "${file}"
  fi
done

find "${ROOT_DIR}" -type f -name "*.tsbuildinfo" -delete

rm -f \
  /tmp/clustercodex-frontend.log \
  /tmp/clustercodex-auth-smoke.json \
  /tmp/clustercodex-backend.log

echo "Clean complete."
