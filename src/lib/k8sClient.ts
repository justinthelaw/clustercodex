/**
 * Provides browser-side API helpers for querying cluster data and requesting plans.
 */
import type {
  CodexAuthStatus,
  Issue,
  PlanGenerationResponse,
  ResourceItem,
  ResourceKind
} from "@/lib/types";

// Executes GET requests and surfaces structured API errors when available.
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string; details?: string };
      if (body?.error) {
        message = body.details ? `${body.error}: ${body.details}` : body.error;
      }
    } catch {
      // Fall back to status-only message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

// Executes POST requests with JSON payloads and consistent error handling.
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const parsed = (await response.json()) as { error?: string; details?: string };
      if (parsed?.error) {
        message = parsed.details ? `${parsed.error}: ${parsed.details}` : parsed.error;
      }
    } catch {
      // Fall back to status-only message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

// Fetches the current cluster issue list.
export async function listIssues(): Promise<Issue[]> {
  return getJson<Issue[]>("/api/issues");
}

// Fetches resources for the selected Kubernetes kind.
export async function listResources(kind: ResourceKind): Promise<ResourceItem[]> {
  const query = new URLSearchParams({ kind }).toString();
  return getJson<ResourceItem[]>(`/api/resources?${query}`);
}

// Requests a generated remediation plan for a specific issue and context.
export async function generatePlan(
  issue: Issue,
  contextSnapshot: string,
  userContext: string
): Promise<PlanGenerationResponse> {
  return postJson<PlanGenerationResponse>("/api/plan", {
    issue,
    contextSnapshot,
    userContext
  });
}

// Loads current Codex authentication readiness details for UI display.
export async function getCodexAuthStatus(): Promise<CodexAuthStatus> {
  return getJson<CodexAuthStatus>("/api/codex/auth");
}
