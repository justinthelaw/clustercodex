const policiesByUser = {
    "user-basic": {
        namespaceAllowList: ["broken", "default"],
        kindAllowList: ["Pod", "Deployment", "Event"],
    },
};
export function getPolicyForUser(user) {
    if (!user)
        return null;
    if (user.role === "admin") {
        return { namespaceAllowList: ["*"], kindAllowList: ["*"] };
    }
    return (policiesByUser[user.id] || { namespaceAllowList: [], kindAllowList: [] });
}
export function updatePolicyForUser(userId, policy) {
    policiesByUser[userId] = policy;
}
function isAllowed(value, allowList) {
    if (allowList.includes("*"))
        return true;
    return allowList.includes(value);
}
export function filterIssuesByPolicy(items, user) {
    const policy = getPolicyForUser(user);
    if (!policy)
        return [];
    if (policy.namespaceAllowList.includes("*") &&
        policy.kindAllowList.includes("*")) {
        return items;
    }
    return items.filter((item) => {
        const ns = item.namespace || "";
        const kind = item.kind || "";
        return (isAllowed(ns, policy.namespaceAllowList) &&
            isAllowed(kind, policy.kindAllowList));
    });
}
export function filterResourcesByPolicy(items, user) {
    const policy = getPolicyForUser(user);
    if (!policy)
        return [];
    if (policy.namespaceAllowList.includes("*") &&
        policy.kindAllowList.includes("*")) {
        return items;
    }
    return items.filter((item) => {
        const ns = item.namespace || "";
        const kind = item.type || item.kind || "";
        const kindAllowed = isAllowed(kind, policy.kindAllowList);
        if (!kindAllowed)
            return false;
        if (!ns)
            return true;
        return isAllowed(ns, policy.namespaceAllowList);
    });
}
