import type { Issue, ResourceItem, ResourceKind } from "@/lib/types";

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

export async function listIssues(): Promise<Issue[]> {
  return getJson<Issue[]>("/api/issues");
}

export async function listResources(kind: ResourceKind): Promise<ResourceItem[]> {
  const query = new URLSearchParams({ kind }).toString();
  return getJson<ResourceItem[]>(`/api/resources?${query}`);
}
