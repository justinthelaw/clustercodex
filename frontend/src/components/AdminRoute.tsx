import { Navigate } from "react-router-dom";
import { useSession } from "../lib/useSession";

type AdminRouteProps = {
  children: React.ReactNode;
};

export default function AdminRoute({ children }: AdminRouteProps) {
  const { auth, loading } = useSession();

  if (loading) {
    return <div className="card">Loading session...</div>;
  }

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (auth.user.role !== "admin") {
    return (
      <div className="card">
        <h2>Admin</h2>
        <p>You do not have access to this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
