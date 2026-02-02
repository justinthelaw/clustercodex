# Cluster Codex Implementation Plan

This document details the implementation plan for Cluster Codex MVP—a 4-hour proof-of-concept demonstrating the core workflow: authenticate → view detected issues → generate fix recommendations.

## MVP Scope

**In Scope**:

- Local JWT authentication (in-memory users)
- Issues table with K8sGPT-detected problems
- LLM responses for the Cluster Codex plan
- Read-only resource tabs (e.g., Pods, Deployments, Nodes, Events)
- Access policy enforcement
- Automated testing (Playwright, unit tests)

## Architecture Overview

**Frontend** (Stateless React):

- Landing page: issues table + generate plan modals.
- Resource tabs: Pods, Deployments, Nodes, Events (read-only).
- Plan view: renders structured JSON for the Cluster Codex plan.
- Admin page: user access policies (simple, single user).
- All state managed via API calls to Express backend.

**Backend** (Node.js + Express API):

- `/api/issues` → reads K8sGPT Result CRDs from cluster → maps to Issue records.
- `/api/resources` → reads Kubernetes via `@kubernetes/client-node`.
- `/api/plans/codex` → builds prompt + redacts + calls Codex (mock).
- `/api/admin/access-policy` → in-memory (Phase 1)
- Handles all business logic, authorization, and external service integration.
- Validates local JWT tokens for authentication.

**Data** (In-memory):

- Stores issues, plans, policies, prompt runs, audit logs.
- Minimal schema optimized for demo and future expansion.
- In-memory on the Express backend.

## Environment Configuration

### Backend `.env`

```bash
PORT=3001
NODE_ENV=development
JWT_SECRET=change-me-in-local
KUBECONFIG=~/.kube/config
KUBE_CONTEXT=k3d-clustercodex
K8SGPT_NAMESPACE=k8sgpt-operator-system
```

### Frontend `.env`

```bash
VITE_BACKEND_URL=http://localhost:3001
```

## Root package.json Scripts

- `infra:start` → runs `scripts/start-infra.sh`
- `infra:stop` → runs `scripts/stop-infra.sh`
- `dev` → starts backend and frontend concurrently
- `dev:backend` → starts Express server with tsx
- `dev:frontend` → starts Vite dev server
- `test:e2e` → runs Playwright tests

## Bash Scripts

Scripts in `scripts/` handle complex orchestration:

- **`start-infra.sh`**: Starts new K3d cluster, installs and configures K8sGPT operator, installs initial broken Deployment.
- **`stop-infra.sh`**: Stops and deletes the K3d cluster.

## Seed Data Specification

**Users** (in-memory for demo):

- Admin: `admin@clustercodex.local` / `admin123!`
- User: `user@clustercodex.local` / `user123!`

**Cluster**:

- name: `local-k3d`
- contextName: `k3d-clustercodex`

**AccessPolicy** (for `user@clustercodex.local`):

- namespaceAllowList: `["broken", "default"]`
- kindAllowList: `["Pod", "Deployment", "Event"]`

**AccessPolicy** (for `admin@clustercodex.local`):

- namespaceAllowList: `["*"]`
- kindAllowList: `["*"]`

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

Returns list of issues from K8sGPT, filtered by access policy.

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

### `GET /api/resources`

Returns list of resources from the cluster, filtered by access policy.

### `POST /api/plans/codex`

Input:

```json
{
  "issueId": "k8sgpt:abc",
  "userContext": "We just deployed v2."
}
```

Returns the Cluster Codex plan.

### `POST /api/admin/access-policy`

Write allow lists for the single PoC user.

## Codex SDK Integration

Use the Codex SDK for plan generation.

**File**: `backend/src/services/codex-service.ts`

**Approach**:

- Initialize the Codex SDK client with standard OpenAI credentials
- Parse JSON response and validate against output schema
- Default model: `gpt-5.2-codex` (OpenAI API)

**Mock Fallback** (`backend/src/services/codex-mock.ts`):

- Hardcode 2-3 sample responses for common issue types (CrashLoopBackOff, ImagePullBackOff, OOMKilled).
- Toggle via `CODEX_MOCK_MODE=true` for offline development or no-GPU machines.

**OpenAI API**: Set `OPENAI_API_KEY=sk-...` in `.env`.

## Codex Prompt + Output Schema

**Decision**: Use strict JSON output and schema validation. No free text.

### Cluster Codex Output Schema

```json
{
  "quickFix": {
    "summary": "string",
    "assumptions": ["string"],
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
  },
  "rootCauseHypotheses": ["string"],
  "evidenceToGather": ["string"],
  "recommendations": ["string"]
}
```

### Guardrails

- **Allowed**: read-only checks, rollout restart suggestion, config diff suggestions.
- **Disallowed**: delete, scale to zero, change PVC, change network policy.
- Each step must include impact + validation.

Unit tests must assert redaction.

## UX Flows (PoC)

### Landing → Issues Table

- Load active issues.
- Empty state: “No issues detected.”
- Error state: “K8sGPT unavailable.”
- Click “Short-term” opens modal with text area.
- Click “Long-term” opens modal with text area.
- Click "Dismiss" removes issue into dismissed issues.
- Click "Dismissed" loads dismissed issues

### Generate Plan

- Collect issue + user context.
- Show loading state with spinner.
- Render structured plan with steps.
- Copy button allows simple export of Codex-generated plan.

### Resource Tabs

- Tabs: Pods, Deployments, Nodes, Events, etc.
- Table view only; no drill-down.

### Admin

- One page: set namespace/kind allow lists.
- Saves to in-memory store.

## Security and Ops

- Auth required for all routes.
- Server-side policy enforcement.

## Testing Plan

1. Playwright journeys: load landing, see expected resources, generate Codex plan.
2. Schema validation tests for Codex output.
3. Redaction unit tests.
4. MCP contract fixture tests.
5. Express API endpoint tests with mocked dependencies.

## Phased Implementation

The MVP is scoped for **~4 hours** of focused development. Each phase has clear deliverables and exit criteria.

### Phase 0: Bootstrap

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

### Phase 1: Auth with Mock API

**Goal**: Working authentication flow and API endpoints returning mock data.

**Deliverables**:

1. **Local Auth integration**:
   - Backend `/api/auth/login` issues JWT for demo users
   - Frontend: Login page with email/password form
   - Protected routes redirect to login when unauthenticated

2. **Mock API endpoints**:
   - `GET /api/issues` — Returns hardcoded array of 3 issues (CrashLoopBackOff, ImagePullBackOff, OOMKilled)
   - `GET /api/resources?kind=Pod` — Returns hardcoded array of pods
   - `POST /api/plans/codex` — Returns combined plan JSON

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
- [x] `POST /api/plans/codex` returns valid plan JSON structure

### Phase 2: Frontend UI

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
   - "Cluster Codex" button per row → opens modal
   - Empty state: "No issues detected"
   - Loading state with spinner

4. **Plan generation modal**:
   - Text area for user context (optional)
   - Submit button triggers API call
   - Loading state during generation
   - Display generated plan with structured formatting

5. **Plan renderer component**:
   - Renders Cluster Codex plan: summary, steps with kubectl commands
   - Renders root cause hypotheses, evidence to gather, recommendations
   - Copy-to-clipboard for kubectl commands

6. **Resource tabs page** (`/resources`):
   - Tab navigation: Pods, Deployments, Nodes, Events
   - Simple table per tab showing mock data
   - No drill-down (read-only display)

7. **Admin page** (`/admin`) — MVP stub:
   - Display current user info
   - Placeholder for access policy form

**Exit Criteria**:

- [x] User can navigate between all pages
- [x] Issues table displays mock data correctly
- [x] Clicking "Short-term" opens modal and generates plan
- [x] Plan displays with proper formatting
- [x] Resource tabs show mock data for each resource type

### Phase 3: K8sGPT Integration

**Goal**: Replace mock issues with real K8sGPT data from the cluster.

**Deliverables**:

1. **K8sGPT Operator deployment**:
   - Helm chart in `charts/k8sgpt-operator/`
   - K8sGPT custom resource configured for context-only mode (no AI backend)
   - Operator creates Result CRDs for detected issues

2. **Backend K8sGPT client**:
   - `backend/src/services/k8sgpt-client.ts`
   - Uses `@kubernetes/client-node` to read K8sGPT Result CRDs
   - Maps Result CRDs to Issue schema

3. **Update `/api/issues`**:
   - Replace mock data with K8sGPT Result CRD data
   - Graceful fallback to empty array if K8sGPT unavailable

**Exit Criteria**:

- [x] K3d cluster running with 3 broken pods
- [x] K8sGPT Operator deployed and creating Result CRDs
- [x] `/api/issues` returns real issues detected by K8sGPT
- [x] Frontend displays real cluster issues

### Phase 4: Codex SDK Plan Generation

**Goal**: Implement Codex SDK for generating fixes.

**Deliverables**:

1. **Codex service integration**:
   - `backend/src/services/codex-service.ts` with Codex SDK client
   - Uses standard OpenAI credentials

2. **Prompt assembly + redaction**:
   - Builds prompt from issue + user context + access policy
   - Redacts sensitive data before LLM call
   - Logs prompt metadata (not raw secrets) for audit

3. **Mock fallback path**:
   - `backend/src/services/codex-mock.ts` returns canned plans
   - `CODEX_MOCK_MODE=true` bypasses LLM calls

4. **Frontend wiring**:
   - `/api/plans/codex` calls real Codex service
   - Plan renderer displays JSON schema-compliant output

**Exit Criteria**:

- [x] Codex SDK reachable and responds to test prompt
- [x] `POST /api/plans/codex` returns schema-valid JSON from LLM or mock
- [x] `CODEX_MOCK_MODE=true` produces deterministic responses
- [x] `CODEX_MOCK_MODE=false` and `OPENAI_API_KEY=sk-*` produces Codex generated responses

### Phase 5: Tests

**Goal**: Add playwright testing for all happy paths, via both `user-basic` and `user-admin` roles.

**Deliverables**:

1. **Playwright E2E**:
   - Login as `admin@clustercodex.local`
   - Login as `user@clustercodex.local`
   - View issues table and open Codex plan modal
   - Generate a plan and assert structured output

**Exit Criteria**:

- [ ] E2E tests pass for both admin and user flows
- [ ] `npm run test:e2e` completes without failures on clean clone
