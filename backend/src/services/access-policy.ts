type AccessPolicy = {
  namespaceAllowList: string[];
  kindAllowList: string[];
};

type UserInfo = {
  id: string;
  email: string | null;
  role: "admin" | "user";
};

const policiesByUser: Record<string, AccessPolicy> = {
  "user-basic": {
    namespaceAllowList: ["broken","my-app"],
    kindAllowList: ["Pod", "Deployment", "Event"],
  },
};

export function getPolicyForUser(user?: UserInfo): AccessPolicy | null {
  if (!user) return null;
  if (user.role === "admin") {
    return { namespaceAllowList: ["*"], kindAllowList: ["*"] };
  }
  return (
    policiesByUser[user.id] || { namespaceAllowList: [], kindAllowList: [] }
  );
}

export function updatePolicyForUser(userId: string, policy: AccessPolicy) {
  policiesByUser[userId] = policy;
}

function isAllowed(value: string, allowList: string[]): boolean {
  if (allowList.includes("*")) return true;
  return allowList.includes(value);
}

export function filterIssuesByPolicy<
  T extends { namespace?: string; kind?: string },
>(items: T[], user?: UserInfo): T[] {
  const policy = getPolicyForUser(user);
  if (!policy) return [];
  if (
    policy.namespaceAllowList.includes("*") &&
    policy.kindAllowList.includes("*")
  ) {
    return items;
  }
  return items.filter((item) => {
    const ns = item.namespace || "";
    const kind = item.kind || "";
    return (
      isAllowed(ns, policy.namespaceAllowList) &&
      isAllowed(kind, policy.kindAllowList)
    );
  });
}

export function filterResourcesByPolicy<
  T extends { namespace?: string; type?: string; kind?: string },
>(items: T[], user?: UserInfo): T[] {
  const policy = getPolicyForUser(user);
  if (!policy) return [];
  if (
    policy.namespaceAllowList.includes("*") &&
    policy.kindAllowList.includes("*")
  ) {
    return items;
  }
  return items.filter((item) => {
    const ns = item.namespace || "";
    const kind = item.type || item.kind || "";
    const kindAllowed = isAllowed(kind, policy.kindAllowList);
    if (!kindAllowed) return false;
    if (!ns) return true;
    return isAllowed(ns, policy.namespaceAllowList);
  });
}
