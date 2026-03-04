const store = new Map();
export function getDismissedForUser(user) {
    if (!user)
        return [];
    return Array.from(store.get(user.id) || []);
}
export function isDismissed(user, issueId) {
    if (!user)
        return false;
    return store.get(user.id)?.has(issueId) ?? false;
}
export function dismissIssue(user, issueId) {
    if (!user)
        return;
    const existing = store.get(user.id) || new Set();
    existing.add(issueId);
    store.set(user.id, existing);
}
export function restoreIssue(user, issueId) {
    if (!user)
        return;
    const existing = store.get(user.id);
    if (!existing)
        return;
    existing.delete(issueId);
}
