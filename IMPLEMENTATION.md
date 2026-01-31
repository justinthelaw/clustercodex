# Cluster Codex Implementation Plan (PoC)

This plan turns the README + analysis block into a concrete, demo-ready PoC. It makes decisions for the open questions with a bias toward speed, safety, and a controlled local environment.

## PoC Decision Summary

- **Scope**: Read-only + plan generation only. No in-app apply/patch actions.
- **Environment**: Single local K3d cluster, single org, single admin.
- **Cluster access**: One kubeconfig with one context.
- **Auth**: Supabase email/password; no SSO.
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
- **Supabase**: Local Docker via `supabase start`, not hosted.
- **Supabase Ports**: API 54321, DB 54322, Studio 54323.
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
- Supabase client for authentication only.

**Backend** (Node.js + Express API):

- `/api/issues` → reads K8sGPT Result CRDs from cluster → maps to Issue records.
- `/api/resources` → reads Kubernetes via `@kubernetes/client-node`.
- `/api/plans/remediation` + `/api/plans/long-term` → builds prompt + redacts + calls Codex (mock).
- `/api/admin/access-policy` → read/write policy rows in Supabase.
- Handles all business logic, authorization, and external service integration.
- Validates Supabase JWT tokens for authentication.

**Data** (Supabase + Prisma):

- Stores issues, plans, policies, prompt runs, audit logs.
- Minimal schema optimized for demo and future expansion.
- Accessed exclusively through Prisma ORM from Express backend.

## Project Structure

```bash
clustercodex/
├── frontend/                  # Stateless React app
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components (Landing, Admin)
│   │   ├── services/          # API client, auth helpers
│   │   ├── types/             # TypeScript interfaces (shared with backend)
│   │   └── App.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/                   # Express API server
│   ├── src/
│   │   ├── routes/            # Express route handlers
│   │   ├── middleware/        # Auth, error handling
│   │   ├── services/          # K8sGPT, Codex, K8s client
│   │   ├── lib/               # Redaction, validation utilities
│   │   ├── types/             # Shared TypeScript interfaces
│   │   └── server.ts          # Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── package.json
│   └── tsconfig.json
├── scripts/                   # Bash scripts for complex orchestration
│   ├── setup.sh               # First-time dependency installation (Supabase, K3d, deps)
│   ├── start-infra.sh         # Start all infrastructure (Supabase, K3d, K8sGPT Operator)
│   ├── stop-infra.sh          # Stop all infrastructure
│   ├── seed-broken-pods.sh    # Deploy broken pods to K3d for testing
│   └── reset.sh               # Full reset (stop, clean volumes, restart)
├── charts/                    # Helm charts for K3d cluster
│   └── k8sgpt-operator/       # K8sGPT Operator deployment (no AI backend)
│       ├── Chart.yaml
│       └── values.yaml        # Configured for context-only mode
├── supabase/                  # Supabase local config
│   └── config.toml            # Local Supabase configuration
├── package.json               # Root scripts for dev workflow
└── README.md
```

## Environment Configuration

### Backend `.env`

```bash
# Supabase (local Docker)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Server
PORT=3001
NODE_ENV=development

# Kubernetes
# K8sGPT Operator is accessed via Result CRDs in-cluster
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
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<from supabase start output>
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

**Users** (created in Supabase Auth + synced to DB):

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

1. Frontend calls Supabase Auth to sign in → receives JWT.
2. Frontend includes JWT in `Authorization: Bearer <token>` header for all API calls.
3. Backend middleware validates JWT with Supabase and extracts user ID.
4. Backend loads user's AccessPolicy and enforces filtering.

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
- “Save plan” writes to Supabase.

### Resource Tabs

- Tabs: Pods, Deployments, Nodes, Events.
- Table view only; no drill-down.

### Admin

- One page: set namespace/kind allow lists, set rate limit for generations/min/user.
- Saves to Supabase + audit log.

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

### Phase 0: Bootstrap (15 minutes)

**Goal**: Get scaffolding in place so coding can begin.

- Create `frontend/`, `backend/`, and `scripts/` directories.
- Initialize `package.json` in root, frontend, backend:
  - Root: scripts for orchestration (see Root package.json Scripts section).
  - Frontend: Vite + React + TypeScript template.
  - Backend: Express + TypeScript + tsx.
- Install dependencies:
  - Frontend: `react`, `react-dom`, `@supabase/supabase-js`, `axios`.
  - Backend: `express`, `@supabase/supabase-js`, `@prisma/client`, `@kubernetes/client-node`, `cors`, `openai`.
  - Dev deps: `typescript`, `@types/node`, `@types/express`, `tsx`, `vite`, `concurrently`.
- Create Helm values for K8sGPT Operator in `charts/k8sgpt-operator/`.
- Create bash scripts in `scripts/` directory:
  - `setup.sh`, `start-infra.sh`, `stop-infra.sh`, `seed-broken-pods.sh`, `reset.sh`.
  - Make executable: `chmod +x scripts/*.sh`.
- Create `.env.example` files in frontend and backend with all required variables.
- Set up `tsconfig.json` for both frontend and backend.
- Initialize Supabase local project: `supabase init`.
- Create basic Express server that responds to `GET /health`.
- Create basic Vite React app that renders "Cluster Codex".
- Run `npm run setup` to verify full bootstrap works.
- Verify both servers start with `npm run dev` and frontend can reach backend health endpoint.

### Phase 1: Data + API (45 minutes)

**Goal**: Database schema, auth middleware, and basic API endpoints with mocks.

- Define Prisma schema in `backend/prisma/schema.prisma`.
- Ensure Supabase Docker is running: `supabase start` (or `npm run infra:start`).
- Get connection credentials from `supabase status` output.
- Run `npm run db:migrate` to create tables.
- Create seed script: `backend/prisma/seed.ts`:
  - Manually create users in Supabase Auth UI or via SDK.
  - Seed Cluster, AccessPolicy records for both users.
- Run `npx prisma db seed`.
- Create auth middleware: `backend/src/middleware/auth.ts`:
  - Extract JWT from Authorization header.
  - Validate with `supabase.auth.getUser(token)`.
  - Attach `req.user` with user ID and role.
- Create error handler middleware: `backend/src/middleware/error.ts`.
- Build `/api/issues` endpoint with hardcoded mock data (array of 2-3 issues).
- Build `/api/resources` endpoint with hardcoded mock data.
- Apply auth middleware to all `/api/*` routes except `/health`.
- Test with curl/Postman using real Supabase JWT.

### Phase 2: UI (45 minutes)

**Goal**: Functional frontend that displays data and handles auth.

- Set up Supabase client in `frontend/src/services/supabase.ts`.
- Create API client: `frontend/src/services/api.ts`:
  - Axios instance with interceptor to add Authorization header.
  - Methods for `getIssues()`, `getResources()`, `createRemediationPlan()`.
- Create login page: `frontend/src/pages/Login.tsx`:
  - Email/password form.
  - Call Supabase sign in.
  - Redirect to landing on success.
- Create issues table component: `frontend/src/components/IssuesTable.tsx`:
  - Fetch from `/api/issues` on mount.
  - Display title, severity, kind, namespace, name.
  - Two buttons per row: "Remediation" and "Long-term".
- Create remediation modal: `frontend/src/components/RemediationModal.tsx`:
  - Text area for user context.
  - Call `/api/plans/remediation` on submit.
  - Display mock response (hardcoded in backend).
- Create plan renderer: `frontend/src/components/PlanRenderer.tsx`:
  - Parse and display structured JSON (steps, risk level, summary).
- Create resource tabs: `frontend/src/pages/ResourceTabs.tsx`:
  - Tabs for Pods, Deployments, Nodes, Events.
  - Simple table displaying mock data from `/api/resources`.
- Create admin page: `frontend/src/pages/Admin.tsx`:
  - Form to edit namespace and kind allow lists.
  - POST to `/api/admin/access-policy`.
- Wire up React Router for navigation.
- Test full auth flow and basic CRUD operations.

### Phase 3: Integrations (60 minutes)

**Goal**: Replace mocks with real services.

- Start infrastructure: `npm run infra:start` (starts Supabase, K3d, K8sGPT).
- Start local LLM: `npm run llm:start` (in separate terminal, requires GPU).
- Create K8sGPT client: `backend/src/services/k8sgpt-client.ts`:
  - Connect to HTTP MCP server at `http://localhost:8089`.
  - Implement `analyze()`, `listResources()`, `getResource()`, `getEvents()`, `getLogs()`.
- Create Kubernetes client: `backend/src/services/k8s-client.ts`:
  - Use official `@kubernetes/client-node` package.
  - Load kubeconfig from `~/.kube/config` using `KubeConfig.loadFromDefault()`.
  - Create `CoreV1Api` and `AppsV1Api` clients for resource queries.
  - Implement read-only methods for Pods, Deployments, Nodes, Events.
- Create redaction utility: `backend/src/lib/redactor.ts`:
  - Strip secrets, env vars, base64 blobs.
  - Unit tests in `redactor.test.ts`.
- Create Codex service: `backend/src/services/codex-service.ts`:
  - Use OpenAI SDK configured for local llama-server.
  - Implement `generateRemediationPlan()` and `generateLongTermPlan()`.
- Create Codex mock service: `backend/src/services/codex-mock.ts`:
  - 3 hardcoded responses for common issues (fallback if no GPU).
- Update `/api/issues` to call K8sGPT `analyze()` and map to Issue schema.
- Update `/api/resources` to call K8s client.
- Update `/api/plans/remediation` to:
  - Enrich issue context with K8sGPT tools.
  - Redact sensitive data.
  - Call Codex service (or mock if `CODEX_MOCK_MODE=true`).
  - Validate response against schema.
  - Store Plan and PromptRun in DB.
- Update `/api/plans/long-term` similarly.
- Deploy sample broken pods: `npm run seed:broken-pods`.
- Verify issues appear in UI and plans generate successfully.

### Phase 4: Admin + Testing (30 minutes)

**Goal**: Finalize admin features and verify with tests.

- Implement `/api/admin/access-policy` POST handler:
  - Update AccessPolicy in database.
  - Create AuditLog entry.
- Add policy enforcement to all endpoints:
  - Filter issues by namespace/kind allow lists.
  - Filter resources by namespace/kind allow lists.
- Write Playwright test: `tests/happy-path.spec.ts`:
  - Sign in as user.
  - See issues table.
  - Click "Remediation" on first issue.
  - Enter context and submit.
  - Verify plan renders.
  - Navigate to resource tabs and verify data.
- Write schema validation test: `tests/codex-schema.test.ts`:
  - Test remediation and long-term output schemas.
- Write redaction unit tests: `tests/redactor.test.ts`.
- Run all tests and fix failures.
- Clean up console logs and add basic error toasts in frontend.

## Local Development Workflow

### Prerequisites

- Node.js 20+
- Docker (for Supabase and K3d)
- Supabase CLI: `brew install supabase/tap/supabase`
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
2. Start Supabase Docker containers
3. Copy Supabase credentials to `.env` files
4. Run database migrations and seed
5. Create K3d cluster
6. Deploy K8sGPT Operator via Helm (no AI backend)

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
- Supabase Studio: <http://localhost:54323>
- Supabase API: <http://localhost:54321>
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

## Definition of Done (PoC)

- Both frontend and backend start with single `npm run dev` command.
- User can sign in with seeded credentials.
- Issues list renders from K8sGPT (or mock if K8sGPT unavailable).
- Remediation plan generates, validates against schema, and displays.
- Long-term plan generates, validates against schema, and displays.
- Plans are persisted to database with PromptRun metadata.
- Redaction tests pass (no secrets/env vars in prompts).
- Policies filter resources/issues in UI and API based on user role.
- Resource tabs display Pods, Deployments, Nodes, Events.
- Admin can update access policies.
- Playwright happy path test passes.
- All API endpoints require authentication.
- Error states display user-friendly messages.

## Troubleshooting Quick Reference

**K8sGPT Operator not detecting issues**:

- Check operator is running: `kubectl get pods -n k8sgpt-operator-system`
- Check K8sGPT CR exists: `kubectl get k8sgpt -A`
- Check Result CRDs: `kubectl get results -A`
- View operator logs: `kubectl logs -n k8sgpt-operator-system -l app.kubernetes.io/name=k8sgpt-operator`

**Supabase not starting**:

- Ensure Docker is running: `docker ps`
- Check Supabase status: `supabase status`
- View logs: `supabase logs`
- Reset if needed: `supabase stop --no-backup && supabase start`

**Database connection issues**:

- Verify `DATABASE_URL` in `backend/.env` is `postgresql://postgres:postgres@localhost:54322/postgres`
- Check Supabase is running: `supabase status`
- Run migrations: `npm run db:migrate`

**Auth failures**:

- Open Supabase Studio: <http://localhost:54323>
- Check users in Authentication > Users
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` match `supabase status` output
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
