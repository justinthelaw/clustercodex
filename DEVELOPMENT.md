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

# Sign in for live Codex planning (OAuth with ChatGPT)
npx codex login --device-auth
```

### Daily Development

```bash
# Setup example cluster and run app
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
- Live plan generation uses `@openai/codex-sdk`.
- Codex runtime env behavior is loaded from `.env` (`.env.example` provides baseline values).
- Required runtime envs: `CODEX_MODEL`, `CODEX_AUTH_MODE`, `CODEX_LOCAL_PROVIDER`.
- API key mode: set `CODEX_AUTH_MODE=api` and `CODEX_API_KEY`.
- Local provider mode examples:
  - `CODEX_LOCAL_PROVIDER=ollama`
  - `CODEX_LOCAL_PROVIDER=llama-server`
  - Required when provider is enabled: `CODEX_LOCAL_BASE_URL`, `CODEX_LOCAL_PROVIDER_ID`, `CODEX_LOCAL_PROVIDER_NAME`, `CODEX_LOCAL_ENV_KEY`
  - Optional: `CODEX_LOCAL_API_KEY`

### In-Cluster Resources

- K8sGPT Operator namespace: `k8sgpt-operator-system`
  - Check issue CRDs with: `kubectl get results -n k8sgpt-operator-system`
- Broken deployment: `broken` namespace (`ImagePullBackOff`)
- GPU test deployment: `gpu-test` namespace (`Pending`)
- PodInfo deployment: `default` namespace (`InvalidImageName`)

### Useful Commands

Cleans all dependencies, testing, example cluster and `.env` artifacts:

```bash
npm run clean
```

### Running Tests

```bash
npm run test
```

For the full local CI-equivalent gate (clean + lint + build + E2E):

```bash
npm run flight-check
```
