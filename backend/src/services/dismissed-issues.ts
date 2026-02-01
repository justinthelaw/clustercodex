type UserInfo = { id: string };

type DismissedStore = Map<string, Set<string>>;

const store: DismissedStore = new Map();

export function getDismissedForUser(user?: UserInfo): string[] {
  if (!user) return [];
  return Array.from(store.get(user.id) || []);
}

export function isDismissed(user: UserInfo | undefined, issueId: string): boolean {
  if (!user) return false;
  return store.get(user.id)?.has(issueId) ?? false;
}

export function dismissIssue(user: UserInfo | undefined, issueId: string) {
  if (!user) return;
  const existing = store.get(user.id) || new Set<string>();
  existing.add(issueId);
  store.set(user.id, existing);
}

export function restoreIssue(user: UserInfo | undefined, issueId: string) {
  if (!user) return;
  const existing = store.get(user.id);
  if (!existing) return;
  existing.delete(issueId);
}
