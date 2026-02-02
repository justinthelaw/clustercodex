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
# Clone and install deps
git clone https://github.com/justinthelaw/clustercodex.git
cd clustercodex
npm run install

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend.env
```

### Daily Development

```bash
# Terminal 1: Start infrastructure
npm run infra:start

# Terminal 2: Start dev servers
npm run dev

# Open http://localhost:5173
# Login (admin): admin@clustercodex.local / admin123!
# Login (user): user@clustercodex.local / user123!
```

**Service URLs**:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3001>
- Backend Health: <http://localhost:3001/health>

**In-Cluster Resources** (accessed via kubeconfig):

- K8sGPT Operator: `k8sgpt-operator-system` namespace
  - Use `kubectl get Results -n k8sgpt-operator-system` to get the `Results` CRDs that contain cluster issues from the K8sGPT scanner
- Broken Deployment: `broken` namespace, displays a `ImagePullBackOff` error
- GPU Test Deployment: `gpu-test` namespace, displays an infinite `Pending` state
- PodInfo Deployment: `podinfo` namespace, displays an `InvalidImageName` error

### Useful Commands

```bash
# Stop all infrastructure
npm run infra:stop

```

### Running Tests

```bash
# Terminal 1: Start infrastructure
npm run infra:start

# Terminal 2: Playwright tests
npm run test:e2e
```
