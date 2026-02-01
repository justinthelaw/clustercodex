import { NavLink, useLocation } from "react-router-dom";
import { clearAuth } from "../lib/auth";
import { useSession } from "../lib/useSession";

export default function Header() {
  const { pathname } = useLocation();
  const { auth } = useSession();

  if (pathname === "/login") {
    return null;
  }

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <header>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "20px"
          }}
        >
          <strong>Cluster Codex</strong>
        </div>
        <nav>
          <NavLink to="/" end>
            Current Issues
          </NavLink>
          <NavLink to="/resources">Resource Explorer</NavLink>
          {auth?.user.role === "admin" && (
            <NavLink to="/admin">Admin Panel</NavLink>
          )}
        </nav>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span>{auth?.user.email ?? ""}</span>
          <button className="button secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
