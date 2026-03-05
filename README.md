# Cluster Codex

**Your local-first Kubernetes troubleshooting workspace.**

For full development and operational documentation beyond quick start, use [DEVELOPMENT.md](DEVELOPMENT.md).

## The Problem

Kubernetes troubleshooting is still high-friction. When workloads fail, teams often bounce between `kubectl`, events, logs, and tribal knowledge to diagnose and recover.

## The Solution

Cluster Codex is a single Next.js application that runs locally against your existing cluster access. This results in:

- No separate backend service to deploy
- Codex auth/provider mode is fully environment-driven via `.env`

The app assumes you already have a valid `kubeconfig` and permissions. Kubernetes access is handled inside the app using [`@kubernetes/client-node`](https://github.com/kubernetes-client/javascript), so your own kubeconfig context and RBAC remain the source of truth.

## How It Works

```mermaid
sequenceDiagram
    box rgb(64, 45, 137) Local Workspace
      actor Developer as Developer
      participant ClusterCodex as Cluster Codex
      participant CodexSDK as Codex SDK
    end
    box rgb(54, 54, 54) Platform Components
      participant KubernetesAPI as Kubernetes API
      participant K8sGPT as K8sGPT Result CRDs
      participant K8sResources as Kubernetes Resources
    end

    Developer->>ClusterCodex: Open dashboard / request analysis
    ClusterCodex->>KubernetesAPI: Read issues and resources
    K8sResources->>KubernetesAPI: Persist workload state
    K8sGPT->>KubernetesAPI: Write Result CRDs
    KubernetesAPI-->>ClusterCodex: Return live cluster data
    ClusterCodex->>CodexSDK: Submit issue + context for planning
    CodexSDK-->>ClusterCodex: Structured remediation plan
    ClusterCodex-->>Developer: Render plan and resource insights
```

1. Start your cluster and ensure K8sGPT is producing `Result` CRDs.
2. Run Cluster Codex.
3. The app reads cluster state using your kubeconfig.
4. Use the UI to inspect issues/resources and generate Codex remediation plans.

## Features

### Issues Dashboard

- Reads K8sGPT `Result` CRDs directly from Kubernetes APIs.
- Shows affected kind, namespace, name, and detection time.
- Supports dismiss/restore with local browser storage.

### Live Codex Plan Generation

- Uses `@openai/codex-sdk` with structured JSON schema output for consistent plan shape.
- Generates comprehensive root-cause analysis, mitigation steps, validation checks, and rollback guidance.
- Falls back to deterministic local planning if Codex is unavailable.
- Supports auth modes via env (`chatgpt`, `api`, `auto`).
- Supports local providers (for example Ollama or llama-server) via env configuration.

### Resource Explorer

Read-only cluster inventory across common resource kinds:

- Pods, Deployments, DaemonSets, StatefulSets, ReplicaSets
- Jobs, CronJobs, Services, Ingresses, Namespaces
- ConfigMaps, Secrets, ServiceAccounts
- PersistentVolumes, PersistentVolumeClaims, CRDs, Nodes, Events

## Technology Stack

| Technology                                                                      | Purpose                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Next.js](https://nextjs.org) + [React](https://react.dev)                      | Frontend UI + in-app route handlers                  |
| [Kubernetes Client JavaScript](https://github.com/kubernetes-client/javascript) | Kubernetes API access via kubeconfig                 |
| [Codex SDK](https://developers.openai.com/codex/sdk)                            | Live cluster issue analysis and remediation planning |
| [K8sGPT Operator](https://docs.k8sgpt.ai/getting-started/in-cluster-operator/)  | In-cluster issue detection                           |
| [K3d](https://k3d.io/stable)                                                    | Local Kubernetes cluster                             |
| [Playwright](https://playwright.dev)                                            | E2E testing                                          |

## Quick Start

```bash
# Prerequisites: Node.js 20+, Docker Engine, K3d, Helm, kubectl

git clone https://github.com/justinthelaw/clustercodex.git
cd clustercodex
npm install
# If your npm config omits optional deps, run:
npm install --include=optional

# `.env.example` sets auth mode to ChatGPT OAuth. Sign in once:
npx codex login --device-auth

# Setup example cluster and run app
npm run dev

# Open http://localhost:3000
```

If cluster fixtures are already running, start only the frontend server:

```bash
npm run dev:app
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for full workflow details, troubleshooting, runtime configuration, and validation guidance.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Security

See [docs/SECURITY.md](docs/SECURITY.md).

## Support

See [docs/SUPPORT.md](docs/SUPPORT.md).

## License

This repository currently has no dedicated license file. Add one before broad reuse.
