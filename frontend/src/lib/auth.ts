const AUTH_KEY = "clustercodex.auth";
const LEGACY_TOKEN_KEY = "clustercodex.token";
export const AUTH_EVENT = "clustercodex:auth";

export type AuthState = {
  token: string;
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
  };
};

export function getAuth(): AuthState | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as AuthState;
    } catch {
      localStorage.removeItem(AUTH_KEY);
    }
  }

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    return {
      token: legacyToken,
      user: { id: "unknown", email: "unknown", role: "user" }
    };
  }

  return null;
}

export function setAuth(auth: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}
