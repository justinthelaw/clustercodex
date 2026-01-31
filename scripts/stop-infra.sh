#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-clustercodex}

if command -v k3d >/dev/null 2>&1; then
  k3d cluster delete "${CLUSTER_NAME}" >/dev/null 2>&1 || true
fi

echo "Cluster Codex testing and dev infrastructure deleted."
