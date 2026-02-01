# Developer Documentation

## Local Development Workflow

### Prerequisites

- Node.js 20+
- Docker (for K3d)
- K3d: `brew install k3d`
- Helm: `brew install helm`
- llama.cpp (for local LLM): `brew install llama.cpp`
- kubectl: `brew install kubectl`

### First Time Setup

```bash
# Clone and install deps
git clone https://github.com/justinthelaw/clustercodex.git
cd clustercodex
npm run install
```

### Daily Development

```bash
# Terminal 1: Start infrastructure
npm run infra:start

# Terminal 2: Start local LLM (optional, requires GPU)
npm run llm:start

# Terminal 3: Start dev servers
npm run dev
```

**Service URLs**:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3001>
- Backend Health: <http://localhost:3001/health>
- Local LLM: <http://localhost:8080>

**In-Cluster Services** (accessed via kubeconfig):

- K8sGPT Operator: `k8sgpt-operator` namespace, Result CRDs in target namespaces

### Useful Commands

```bash
# Stop all infrastructure
npm run infra:stop

# Stop the llama.cpp llama-server
npm run llm:stop
```

### Running Tests

```bash
# Terminal 1: Start infrastructure
npm run infra:start

# Terminal 2: Playwright tests
npm run test:e2e
```
