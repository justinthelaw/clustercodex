# Cluster Codex Implementation Plan

This document details the implementation plan for Cluster Codex MVP—a 4-hour proof-of-concept demonstrating the core workflow: authenticate → view detected issues → generate fix recommendations.

## MVP Scope

**In Scope**:

- Local JWT authentication (in-memory users)
- Issues table with K8sGPT-detected problems
- Mock LLM responses for remediation and long-term plans
- Read-only resource tabs (Pods, Deployments, Nodes, Events)
- Basic admin page stub

**Out of Scope (Post-MVP)**:

- Real LLM integration (OpenAI API or local llama-server)
- Database persistence (Prisma)
- Access policy enforcement
- Automated testing (Playwright, unit tests)

## PoC Decision Summary

- **Scope**: Read-only + plan generation only. No in-app apply/patch actions.
- **Environment**: Single local K3d cluster, single org, single admin.
- **Cluster access**: One kubeconfig with one context.
- **Auth**: Local email/password + JWT; no SSO.
- **Multi-tenancy**: Not in PoC.
- **Authorization**: App-layer filtering only (no per-user K8s RBAC).
- **Real-time**: Polling every 30s for issues; no watches/streaming.
- **K8sGPT**: In-cluster Operator deployed via Helm; no AI backend (context-only mode).
- **Codex**: OpenAI SDK pointing to local llama-server (switchable to real OpenAI API).
- **UI**: Minimal, two main screens (Landing + Admin).
- **Testing**: Playwright happy paths + schema validation + redaction unit tests.
- **Project Structure**: Monorepo with `/frontend`, `/backend`, `/scripts`, and `/charts` directories.
- **Build Tools**: Vite for frontend, tsx/ts-node for backend development.
- **Orchestration**: Package.json scripts for simple tasks, bash scripts in `/scripts` for complex workflows.
- **Frontend Port**: 5173 (Vite default).
- **Backend Port**: 3001.
- **K8sGPT Operator**: Deployed in-cluster via Helm; accessed via Result CRDs.
- **K8s Client**: `@kubernetes/client-node` (official Kubernetes JavaScript client).
- **Kubeconfig**: Read from `~/.kube/config` or `KUBECONFIG` env var.
- **Codex SDK**: OpenAI Codex SDK (`openai`) with configurable base URL.
- **LLM Default**: Local llama-server at `http://localhost:8080` running `unsloth/gemma-3-12b-it-GGUF`.
- **LLM Port**: 8080 (llama-server).

## Architecture Overview

**Frontend** (Stateless React):

- Landing page: issues table + generate plan modals.
- Resource tabs: Pods, Deployments, Nodes, Events (read-only).
- Plan view: renders structured JSON (remediation + long-term).
- Admin page: user access policies (simple, single user).
- All state managed via API calls to Express backend.

**Backend** (Node.js + Express API):

- `/api/issues` → reads K8sGPT Result CRDs from cluster → maps to Issue records.
- `/api/resources` → reads Kubernetes via `@kubernetes/client-node`.
- `/api/plans/remediation` + `/api/plans/long-term` → builds prompt + redacts + calls Codex (mock).
- `/api/admin/access-policy` → in-memory (Phase 1)
- Handles all business logic, authorization, and external service integration.
- Validates local JWT tokens for authentication.

**Data** (In-memory + future Prisma):

- Stores issues, plans, policies, prompt runs, audit logs.
- Minimal schema optimized for demo and future expansion.
- Accessed exclusively through Prisma ORM from Express backend.

## Environment Configuration

### Backend `.env`

```bash
# Local Auth
JWT_SECRET=change-me-in-local

# Server
PORT=3001
NODE_ENV=development

# Kubernetes
KUBECONFIG=~/.kube/config
KUBE_CONTEXT=k3d-clustercodex

# Codex SDK (OpenAI-compatible API)
CODEX_BASE_URL=http://localhost:8080/v1
CODEX_API_KEY=not-needed-for-local
CODEX_MODEL=gemma-3-12b-it
CODEX_MOCK_MODE=false

# For OpenAI API (optional, for production or testing with real API)
# CODEX_BASE_URL=https://api.openai.com/v1
# CODEX_API_KEY=sk-...
# CODEX_MODEL=gpt-5.2-codex
```

### Frontend `.env`

```bash
VITE_BACKEND_URL=http://localhost:3001
```

## Root package.json Scripts

- `setup` → runs `scripts/setup.sh`
- `infra:start` → runs `scripts/start-infra.sh`
- `infra:stop` → runs `scripts/stop-infra.sh`
- `reset` → runs `scripts/reset.sh`
- `dev` → starts backend and frontend concurrently
- `dev:backend` → starts Express server with tsx
- `dev:frontend` → starts Vite dev server
- `db:migrate` → runs Prisma migrations
- `db:seed` → runs Prisma seed script
- `db:studio` → opens Prisma Studio
- `test:unit` → runs backend unit tests
- `test:e2e` → runs Playwright tests
- `seed:broken-pods` → runs `scripts/seed-broken-pods.sh`
- `llm:start` → starts llama-server with Gemma 3 12B

## Bash Scripts

Scripts in `scripts/` handle complex orchestration:

- **`setup.sh`**: First-time setup. Installs deps, starts Supabase, copies credentials to `.env`, runs migrations/seed, creates K3d cluster, deploys K8sGPT Operator.
- **`start-infra.sh`**: Starts Supabase and K3d cluster (K8sGPT Operator runs in-cluster).
- **`stop-infra.sh`**: Stops Supabase and K3d cluster.
- **`seed-broken-pods.sh`**: Deploys 3 broken pods (CrashLoopBackOff, ImagePullBackOff, OOMKilled) to K3d for testing.
- **`reset.sh`**: Full reset—stops infra, deletes cluster, resets Supabase, re-runs migrations.

## Seed Data Specification

**Users** (in-memory for demo):

- Admin: `admin@clustercodex.local` / `admin123!`
- User: `user@clustercodex.local` / `user123!`

**Cluster**:

- name: `local-k3d`
- contextName: `k3d-clustercodex`

**AccessPolicy** (for `user@clustercodex.local`):

- namespaceAllowList: `["default", "kube-system"]`
- kindAllowList: `["Pod", "Deployment", "Node", "Event"]`

**AccessPolicy** (for `admin@clustercodex.local`):

- namespaceAllowList: `["*"]`
- kindAllowList: `["*"]`

## Data Model (Prisma)

Minimal, PoC-focused schema (single org, but fields left for future growth):

- **User**
  - `id`, `email`, `role` (`admin` | `user`)
- **Cluster**
  - `id`, `name`, `contextName`, `createdAt`
- **AccessPolicy**
  - `id`, `userId`, `clusterId`, `namespaceAllowList`, `kindAllowList`
- **Issue**
  - `id`, `clusterId`, `title`, `severity`, `kind`, `namespace`, `name`
  - `rawJson`, `detectedAt`, `status`
- **Plan**
  - `id`, `issueId`, `type` (`remediation` | `long_term`)
  - `summary`, `riskLevel`, `json`, `createdAt`
- **PromptRun**
  - `id`, `planId`, `model`, `inputTokens`, `outputTokens`, `latencyMs`, `rawResponse`
- **AuditLog**
  - `id`, `userId`, `action`, `targetType`, `targetId`, `createdAt`

**Retention**:

- No retention plan
- Deletion is performed by users

**PII/Secrets**:

- Do not store raw manifests or logs in DB.
- Store only redacted snippets in `Plan.json`.

## API Contracts (PoC)

### Authentication Flow

1. Frontend calls `/api/auth/login` with email/password.
2. Backend returns JWT.
3. Frontend includes JWT in `Authorization: Bearer <token>` header for all API calls.
4. Backend validates JWT and enforces filtering.

### Error Response Format

```json
{
  "error": "string",
  "code": "AUTH_REQUIRED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR",
  "details": {}
}
```

### `GET /api/issues`

Returns list of issues from K8sGPT, filtered by policy.

Response (array):

```json
[
  {
    "id": "k8sgpt:abc",
    "title": "CrashLoopBackOff",
    "severity": "high",
    "kind": "Pod",
    "namespace": "default",
    "name": "api-7f9d5",
    "detectedAt": "2026-01-31T00:00:00Z"
  }
]
```

### `GET /api/resources?kind=Pod&namespace=default`

Read-only list for resource tabs.

### `POST /api/plans/remediation`

Input:

```json
{
  "issueId": "k8sgpt:abc",
  "userContext": "We just deployed v2."
}
```

### `POST /api/plans/long-term`

Same input; different prompt + response schema.

### `POST /api/admin/access-policy`

Write allow lists for the single PoC user.

## Codex SDK Integration

Use the OpenAI SDK (`openai` npm package) configured to point at a local llama-server for zero API cost during development.

**File**: `backend/src/services/codex-service.ts`

**Approach**:

- Initialize OpenAI client with `CODEX_BASE_URL` (default: `http://localhost:8080/v1`)
- Use `chat.completions.create()` with `response_format: { type: 'json_object' }`
- Parse JSON response and validate against output schema
- Default model: `gemma-3-12b-it` (local) or `gpt-5.2-codex` (OpenAI API)

**Local LLM**: Run `npm run llm:start` to start llama-server with Gemma 3 12B (~8GB VRAM required).

**Mock Fallback** (`backend/src/services/codex-mock.ts`):

- Hardcode 2-3 sample responses for common issue types (CrashLoopBackOff, ImagePullBackOff, OOMKilled).
- Toggle via `CODEX_MOCK_MODE=true` for offline development or no-GPU machines.

**Switching to OpenAI API**: Set `CODEX_BASE_URL=https://api.openai.com/v1`, `CODEX_API_KEY=sk-...`, `CODEX_MODEL=gpt-5.2-codex` in `.env`.

## K8sGPT MCP Contract (Implementation-Aligned)

This section mirrors the **actual MCP server contracts** and tool list so Cluster Codex can safely shape its context pipeline.

### MCP Server Modes

- **Stdio mode** for local use: `k8sgpt serve --mcp`
- **HTTP mode** for local network calls: `k8sgpt serve --mcp --mcp-http --mcp-port 8089`

### K8sGPT Backend Configuration

K8sGPT uses the local llama-server as its AI backend (same as Codex):

- Backend type: `localai`
- Backend URL: `http://localhost:8080`
- Model: `gemma-3-12b-it`

Configure via: `k8sgpt auth add --backend localai --baseurl http://localhost:8080 --model gemma-3-12b-it`

### Available Tools (PoC Subset)

From the official MCP reference, K8sGPT exposes tools for analysis, resource queries, logs/events, and analyzer management. For PoC, we use only **read-only** tools: citeturn10view0

- `analyze`
- `cluster-info`
- `list-resources`
- `get-resource`
- `list-namespaces`
- `get-logs`
- `list-events`

### Tool Request Schemas (From MCP Implementation)

The MCP server’s Go types define the `analyze` and `cluster-info` request/response structures:

- **AnalyzeRequest**
  - `namespace?: string`
  - `backend?: string`
  - `language?: string`
  - `filters?: string[]`
  - `labelSelector?: string`
  - `noCache?: bool`
  - `explain?: bool`
  - `maxConcurrency?: int`
  - `withDoc?: bool`
  - `interactiveMode?: bool`
  - `customHeaders?: string[]`
  - `withStats?: bool`
  - `anonymize?: bool`
- **AnalyzeResponse**
  - `results: string`
- **ClusterInfoResponse**
  - `info: string`

### Tool Parameters (Docs)

The MCP docs specify the input parameters for the rest of the tools:

- **list-resources**: `resourceType`, `namespace?`, `labelSelector?`
- **get-resource**: `resourceType`, `name`, `namespace?`
- **list-namespaces**: no parameters
- **get-logs**: `podName`, `namespace?`, `container?`, `tail?`, `previous?`, `sinceSeconds?`
- **list-events**: `namespace?`, `involvedObjectName?`, `involvedObjectKind?`

### Response Shape Strategy (PoC)

Only `analyze` and `cluster-info` response fields are typed in the server package (`results` and `info` are strings). For all other tools, **treat responses as opaque JSON/text** and normalize them defensively.

Implementation decision:

- Set K8sGPT output format to **JSON** (CLI supports JSON output) and treat `AnalyzeResponse.results` as a JSON string payload. citeturn9search5
- Create a small **schema discovery step** during dev: call `tools/list` and `tools/call` via MCP to capture example payloads as fixtures, then lock a minimal parsing layer to those observed shapes.
- If parsing fails, show raw response in a fallback viewer and proceed with partial context.

### Context Enrichment Pipeline (PoC)

For each issue from `analyze`:

1. `get-resource` for the implicated object.
2. `list-events` filtered by `involvedObjectName` + `involvedObjectKind`.
3. `get-logs` (tail 200, last 900s) for pods only.
4. `cluster-info` once per session.

All payloads are **redacted** before sending to Codex.

### Failure Behavior

- If `analyze` fails: UI warning + empty list.
- If enrichment fails: continue with partial context and annotate missing data.

## Codex Prompt + Output Schema

**Decision**: Use strict JSON output and schema validation. No free text.

### Remediation Output Schema

```json
{
  "summary": "string",
  "assumptions": ["string"],
  "riskLevel": "low|medium|high",
  "steps": [
    {
      "stepId": "string",
      "description": "string",
      "kubectl": "string|null",
      "validation": "string",
      "rollback": "string|null",
      "impact": "none|low|medium|high"
    }
  ],
  "fallback": "string"
}
```

### Long-term Output Schema

```json
{
  "summary": "string",
  "rootCauseHypotheses": ["string"],
  "evidenceToGather": ["string"],
  "recommendations": ["string"],
  "riskLevel": "low|medium|high"
}
```

### Guardrails

- **Allowed**: read-only checks, rollout restart suggestion, config diff suggestions.
- **Disallowed**: delete, scale to zero, change PVC, change network policy.
- Each step must include impact + validation.

## Redaction Rules

Before any Codex call, strip or mask:

- Secrets (`kind: Secret`, `data`, `stringData`)
- Env vars matching `PASSWORD|TOKEN|SECRET|KEY|CERT`
- Base64 blobs longer than 40 chars
- Any kubeconfig content

Unit tests must assert redaction.

## UX Flows (PoC)

### Landing → Issues Table

- Load issues.
- Empty state: “No issues detected.”
- Error state: “K8sGPT unavailable.”
- Click “Remediation” opens modal with text area.
- Click “Long-term” opens modal with text area.

### Generate Plan

- Collect issue + user context.
- Show loading state with spinner.
- Render structured plan with steps + risk.
- “Save plan” writes to in-memory storage (Phase 1).

### Resource Tabs

- Tabs: Pods, Deployments, Nodes, Events.
- Table view only; no drill-down.

### Admin

- One page: set namespace/kind allow lists, set rate limit for generations/min/user.
- Saves to in-memory store + audit log (Phase 1).

## Security and Ops

- Auth required for all routes.
- Server-side policy enforcement.
- Newly registered users have empty allow list.
- Rate limit: admin-set plan for generations/min/user.
- Audit log for: plan generation + admin policy changes.

## Testing Plan

1. Playwright journeys: load landing, see expected resources, generate remediation plan.
2. Schema validation tests for Codex output.
3. Redaction unit tests.
4. MCP contract fixture tests.
5. Express API endpoint tests with mocked dependencies.

## Phased Implementation

The MVP is scoped for **~4 hours** of focused development. Each phase has clear deliverables and exit criteria.

### Phase 0: Bootstrap (~45 minutes)

**Goal**: Project scaffolding, infrastructure scripts, and "hello world" for both frontend and backend.

**Deliverables**:

1. **Directory structure**:
   - `frontend/` — Vite + React + TypeScript
   - `backend/` — Express + TypeScript
   - `scripts/` — Bash infrastructure scripts
   - `charts/k8sgpt-operator/` — Helm values
   - `charts/broken-pod/` — Helm chart that deploys an invalid image

2. **Package initialization**:
   - Root `package.json` with orchestration scripts
   - Frontend `package.json` with: `react`, `react-dom`, `axios`, `react-router-dom`
   - Backend `package.json` with: `express`, `cors`, `dotenv`
   - Dev dependencies: `typescript`, `@types/*`, `tsx`, `vite`, `concurrently`

3. **Infrastructure scripts** (stubbed, minimal functionality):
   - `scripts/setup.sh` — Install deps, create K3d cluster
   - `scripts/start-infra.sh` — Start K3d
   - `scripts/stop-infra.sh` — Stop K3d
   - `scripts/seed-broken-pods.sh` — Deploy test pods (placeholder)

4. **Configuration files**:
   - `tsconfig.json` for frontend and backend
   - `.env.example` files with all required variables
   - `vite.config.ts` with proxy to backend

5. **Minimal running apps**:
   - Backend: Express server with `GET /health` returning `{ status: "ok" }`
   - Frontend: Vite React app displaying "Cluster Codex" and fetching `/health`

**Exit Criteria**:

- [x] `npm install` succeeds in root, frontend, and backend
- [x] `npm run dev` starts both servers without errors
- [x] Frontend at `http://localhost:5173` displays "Cluster Codex"
- [x] Frontend successfully calls `http://localhost:3001/health`
- [x] `npm run infra:start` starts K3d (optional for this phase)

### Phase 1: Auth + Mock API (~60 minutes)

**Goal**: Working authentication flow and API endpoints returning mock data.

**Deliverables**:

1. **Local Auth integration**:
   - Backend `/api/auth/login` issues JWT for demo users
   - Frontend: Login page with email/password form
   - Protected routes redirect to login when unauthenticated

2. **Mock API endpoints**:
   - `GET /api/issues` — Returns hardcoded array of 3 issues (CrashLoopBackOff, ImagePullBackOff, OOMKilled)
   - `GET /api/resources?kind=Pod` — Returns hardcoded array of pods
   - `POST /api/plans/remediation` — Returns hardcoded remediation plan JSON
   - `POST /api/plans/long-term` — Returns hardcoded long-term plan JSON

3. **Error handling**:
   - Express error middleware with consistent JSON error format
   - Frontend error boundaries and toast notifications

4. **Seed data** (built-in):
   - Demo users in-memory: `admin@clustercodex.local`, `user@clustercodex.local`

**Exit Criteria**:

- [x] User can sign in with demo credentials
- [x] Unauthenticated requests to `/api/*` return 401
- [x] Authenticated requests to `/api/issues` return mock issue array
- [x] User cannot access the admin panel if they are not admin role
- [x] `POST /api/plans/remediation` returns valid plan JSON structure

### Phase 2: Frontend UI (~75 minutes)

**Goal**: Complete UI with all screens functional using mock API data.

**Deliverables**:

1. **Navigation and layout**:
   - React Router setup with routes: `/login`, `/`, `/resources`, `/admin`
   - Header with navigation and logout button
   - Protected route wrapper

2. **Login page** (`/login`):
   - Email/password form
   - Error display for invalid credentials
   - Redirect to landing on success

3. **Issues landing page** (`/`):
   - Issues table with columns: Title, Severity, Kind, Namespace, Name, Actions
   - "Remediation" button per row → opens modal
   - "Long-term" button per row → opens modal
   - Empty state: "No issues detected"
   - Loading state with spinner

4. **Plan generation modal**:
   - Text area for user context (optional)
   - Submit button triggers API call
   - Loading state during generation
   - Display generated plan with structured formatting

5. **Plan renderer component**:
   - Renders remediation plan: summary, risk level, steps with kubectl commands
   - Renders long-term plan: summary, hypotheses, recommendations
   - Copy-to-clipboard for kubectl commands

6. **Resource tabs page** (`/resources`):
   - Tab navigation: Pods, Deployments, Nodes, Events
   - Simple table per tab showing mock data
   - No drill-down (read-only display)

7. **Admin page** (`/admin`) — MVP stub:
   - Display current user info
   - Placeholder for access policy form

**Exit Criteria**:

- [ ] User can navigate between all pages
- [ ] Issues table displays mock data correctly
- [ ] Clicking "Remediation" opens modal and generates plan
- [ ] Plan displays with proper formatting
- [ ] Resource tabs show mock data for each resource type

### Phase 3: K8sGPT Integration (~60 minutes)

**Goal**: Replace mock issues with real K8sGPT data from the cluster.

**Deliverables**:

1. **K3d cluster with broken pods**:
   - `scripts/seed-broken-pods.sh` deploys 3 intentionally broken pods:
     - `crashloop-pod`: Container that exits immediately (CrashLoopBackOff)
     - `imagepull-pod`: References non-existent image (ImagePullBackOff)
     - `oom-pod`: Memory limit too low for workload (OOMKilled)

2. **K8sGPT Operator deployment**:
   - Helm chart in `charts/k8sgpt-operator/`
   - K8sGPT custom resource configured for context-only mode (no AI backend)
   - Operator creates Result CRDs for detected issues

3. **Backend K8sGPT client**:
   - `backend/src/services/k8sgpt-client.ts`
   - Uses `@kubernetes/client-node` to read K8sGPT Result CRDs
   - Maps Result CRDs to Issue schema

4. **Update `/api/issues`**:
   - Replace mock data with K8sGPT Result CRD data
   - Graceful fallback to empty array if K8sGPT unavailable

**Exit Criteria**:

- [ ] K3d cluster running with 3 broken pods
- [ ] K8sGPT Operator deployed and creating Result CRDs
- [ ] `/api/issues` returns real issues detected by K8sGPT
- [ ] Frontend displays real cluster issues

### Phase 4: Polish + Demo Prep (~30 minutes)

**Goal**: Clean up rough edges and ensure demo-ready state.

**Deliverables**:

1. **Error handling improvements**:
   - User-friendly error messages (not raw stack traces)
   - Toast notifications for API errors
   - Graceful degradation when services unavailable

2. **Loading states**:
   - Skeleton loaders for tables
   - Spinner during plan generation
   - Disabled buttons while loading

3. **Demo data verification**:
   - Verify all 3 broken pods create K8sGPT Results
   - Verify mock plans are realistic and helpful
   - Test full flow: login → view issues → generate plan

4. **Documentation**:
   - Update README with final quick start
   - Verify all scripts work on clean checkout

**Exit Criteria**:

- [ ] Full demo flow works without errors
- [ ] Error states display helpful messages
- [ ] Loading states prevent double-submissions
- [ ] `npm run setup && npm run infra:start && npm run dev` works on clean clone

---

## Post-MVP Phases (Future Work)

### Phase 5: Real Kubernetes Client

Replace mock resources with live cluster data:

- Implement `@kubernetes/client-node` for Pods, Deployments, Nodes, Events
- Add namespace/kind filtering based on user access policies

### Phase 6: Real LLM Integration

Replace mock plans with actual LLM generation:

- OpenAI SDK with configurable base URL (OpenAI API or local llama-server)
- Implement redaction utility for sensitive data
- Validate LLM responses against output schemas

### Phase 7: Database Persistence

Add Prisma for data persistence:

- Store generated plans for history
- Audit logging for plan generation
- Access policy storage

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
# Clone and run setup (handles everything)
git clone <repo-url>
cd clustercodex
npm run setup
```

The setup script will:

1. Install all npm dependencies (root, frontend, backend)
2. Create K3d cluster
3. Deploy K8sGPT Operator via Helm (no AI backend)

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
# Deploy broken pods for testing
npm run seed:broken-pods

# Open Prisma Studio (DB viewer)
npm run db:studio

# Run migrations after schema change
npm run db:migrate

# Full reset (clears all data)
npm run reset

# Stop all infrastructure
npm run infra:stop
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# E2E tests (requires infra running)
npm run test:e2e
```

## Definition of Done (MVP)

The MVP is complete when:

**Core Functionality**:

- [ ] `npm run dev` starts both frontend and backend
- [ ] User can sign in with demo credentials
- [ ] Issues table displays K8sGPT-detected issues (or mocks)
- [ ] "Remediation" button generates and displays a plan
- [ ] "Long-term" button generates and displays a plan
- [ ] Resource tabs display Pods, Deployments, Nodes, Events

**Infrastructure**:

- [ ] `npm run setup` bootstraps entire project from scratch
- [ ] `npm run infra:start` starts K3d
- [ ] K8sGPT Operator deploys and detects issues from broken pods

**Quality**:

- [ ] All API endpoints require authentication
- [ ] Error states display user-friendly messages
- [ ] Loading states prevent double-submissions

## Troubleshooting Quick Reference

**K8sGPT Operator not detecting issues**:

- Check operator is running: `kubectl get pods -n k8sgpt-operator-system`
- Check K8sGPT CR exists: `kubectl get k8sgpt -A`
- Check Result CRDs: `kubectl get results -A`
- View operator logs: `kubectl logs -n k8sgpt-operator-system -l app.kubernetes.io/name=k8sgpt-operator`

**Auth failures**:

- Verify demo users in `backend/src/services/auth-store.ts`
- Verify JWT token is being sent: check browser Network tab

**Local LLM not responding**:

- Check if running: `ps aux | grep llama-server`
- Verify port: `curl http://localhost:8080/health`
- Check GPU memory: `nvidia-smi` (requires ~8GB VRAM for Gemma 3 12B)
- Use mock mode if no GPU: set `CODEX_MOCK_MODE=true` in `backend/.env`

**CORS errors**:

- Backend must have `cors()` middleware configured for `http://localhost:5173`
- Check browser console for specific CORS error message

**Kubeconfig not found**:

- Ensure K3d cluster exists: `k3d cluster list`
- Set context: `kubectl config use-context k3d-clustercodex`
- Verify kubeconfig exists: `ls ~/.kube/config`
