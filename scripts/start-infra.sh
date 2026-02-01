#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-clustercodex}
KUBE_CONTEXT="k3d-${CLUSTER_NAME}"
K8SGPT_NAMESPACE=${K8SGPT_NAMESPACE:-k8sgpt-operator-system}
K8SGPT_RELEASE=${K8SGPT_RELEASE:-k8sgpt-operator}
BROKEN_RELEASE=${BROKEN_RELEASE:-broken-pod}
BROKEN_NAMESPACE=${BROKEN_NAMESPACE:-broken}

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
helm upgrade --install "${K8SGPT_RELEASE}" k8sgpt/k8sgpt-operator \
  --namespace "${K8SGPT_NAMESPACE}" \
  --create-namespace

echo "Installing K8sGPT configuration"
kubectl apply -f charts/k8sgpt/k8sgpt-configuration.yaml

echo "Deploying broken pod chart"
helm upgrade --install "${BROKEN_RELEASE}" ./charts/broken-pod \
  --namespace "${BROKEN_NAMESPACE}" \
  --create-namespace

echo "Checking K8sGPT Result CRDs"
kubectl get results -A || true

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
  echo "Result CRDs found:"
  kubectl get results -n "${K8SGPT_NAMESPACE}"
else
  echo "No Result CRDs found in ${K8SGPT_NAMESPACE} after 60s. Please check the cluster and K8sGPT deployment for issues."
  exit 1
fi

echo "Cluster Codex testing and dev infrastructure ready."
