/**
 * Persists dismissed issue identifiers in browser storage for UI state continuity.
 */
const STORAGE_KEY = "clustercodex.dismissedIssueIds";

/** Reads dismissed issue identifiers from local storage when running in the browser. */
export function loadDismissedIssueIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

/** Stores dismissed issue identifiers for future dashboard sessions. */
export function saveDismissedIssueIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids.values())));
}
