# Developer Documentation

## Local Development Workflow

### Prerequisites

- Node.js 20+
- Docker Engine (for K3d)
- K3d: `brew install k3d`
- Helm: `brew install helm`
- kubectl: `brew install kubectl`

### First Time Setup

```bash
git clone https://github.com/justinthelaw/clustercodex.git
cd clustercodex
npm install
cp .env.example .env.local
```

### Daily Development

```bash
# Terminal 1: Start infrastructure
npm run infra:start

# Terminal 2: Start app
npm run dev
```

Open <http://localhost:3000>.

### Service URLs

- App: <http://localhost:3000>

### Cluster Access Model

- The app uses `@kubernetes/client-node` from in-app route handlers.
- It reads kubeconfig from:
  - `KUBECONFIG` if set
  - otherwise the default kubeconfig location (for example `~/.kube/config`)
- Optional context override: `KUBE_CONTEXT`

### In-Cluster Resources

- K8sGPT Operator namespace: `k8sgpt-operator-system`
  - Check issue CRDs with: `kubectl get results -n k8sgpt-operator-system`
- Broken deployment: `broken` namespace (`ImagePullBackOff`)
- GPU test deployment: `gpu-test` namespace (`Pending`)
- PodInfo deployment: `default` namespace (`InvalidImageName`)

### Useful Commands

```bash
# Stop all infrastructure
npm run infra:stop
```

### Running Tests

```bash
# Terminal 1
npm run infra:start

# Terminal 2
npm run test:e2e
```

For the full local CI-equivalent gate (clean + lint + build + E2E):

```bash
npm run flight-check
```
