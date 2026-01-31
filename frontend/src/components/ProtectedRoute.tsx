import { Navigate } from "react-router-dom";
import { useSession } from "../lib/useSession";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { auth, loading } = useSession();

  if (loading) {
    return <div className="card">Loading session...</div>;
  }

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
