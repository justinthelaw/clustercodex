#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-clustercodex}
KUBE_CONTEXT="k3d-${CLUSTER_NAME}"
K8SGPT_NAMESPACE="k8sgpt-operator-system"

command -v k3d >/dev/null 2>&1 || { echo "k3d is required"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm is required"; exit 1; }

if ! k3d cluster list | awk '{print $1}' | grep -q "^${CLUSTER_NAME}$"; then
  echo "Creating k3d cluster: ${CLUSTER_NAME}"
  k3d cluster create "${CLUSTER_NAME}" --servers 1 --agents 1
else
  echo "k3d cluster ${CLUSTER_NAME} already exists"
fi

kubectl config use-context "${KUBE_CONTEXT}" >/dev/null

echo "Installing K8sGPT Operator"
helm repo add k8sgpt https://charts.k8sgpt.ai/ >/dev/null
helm repo update >/dev/null
helm upgrade --install k8sgpt-operator k8sgpt/k8sgpt-operator \
  --namespace "${K8SGPT_NAMESPACE}" \
  --create-namespace

echo "Installing K8sGPT configuration"
kubectl apply -f charts/k8sgpt/configuration.yaml

echo "Deploying podinfo chart with bad values"
helm upgrade --install podinfo oci://ghcr.io/stefanprodan/charts/podinfo \
  --values "./charts/podinfo/values.yaml"

echo "Deploying deployment wih fake image reference"
kubectl apply -f ./charts/broken-deployment/deployment.yaml

echo "Deploying GPU pod into a non-GPU cluster"
kubectl apply -f ./charts/gpu-test/deployment.yaml

echo "Waiting up to 60s for Result CRDs in namespace: ${K8SGPT_NAMESPACE}"
FOUND_RESULTS=false
for i in {1..12}; do
  if kubectl get results -n "${K8SGPT_NAMESPACE}" >/dev/null 2>&1; then
    if kubectl get results -n "${K8SGPT_NAMESPACE}" -o name | grep -q .; then
      FOUND_RESULTS=true
      break
    fi
  fi
  sleep 5
done

if [ "${FOUND_RESULTS}" = true ]; then
  echo "Cluster Codex testing and dev infrastructure ready."
else
  echo "No Result CRDs found in ${K8SGPT_NAMESPACE} after 60s. Please check the cluster and K8sGPT deployment for issues."
  exit 1
fi
