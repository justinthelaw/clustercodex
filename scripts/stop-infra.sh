#!/usr/bin/env bash
# Tears down the local k3d cluster used for development and E2E validation.
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-clustercodex}

if command -v k3d >/dev/null 2>&1; then
  k3d cluster delete "${CLUSTER_NAME}" || true
fi

echo "Cluster Codex testing and dev infrastructure deleted."
