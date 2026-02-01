import { useEffect, useState } from "react";
import { AUTH_EVENT, getAuth, type AuthState } from "./auth";

type SessionState = {
  auth: AuthState | null;
  loading: boolean;
};

export function useSession(): SessionState {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getAuth();
    setAuth(stored);
    setLoading(false);

    const handler = () => setAuth(getAuth());
    window.addEventListener("storage", handler);
    window.addEventListener(AUTH_EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(AUTH_EVENT, handler);
    };
  }, []);

  return { auth, loading };
}
