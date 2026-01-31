import { useEffect, useState } from "react";
import { getAuth, type AuthState } from "./auth";

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
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { auth, loading };
}
