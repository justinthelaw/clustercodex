"use client";

/**
 * Renders global navigation and brand context for top-level application routes.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

// Chooses the correct nav link styling for the current route.
function navClass(isActive: boolean): string {
  return isActive ? "nav-link active" : "nav-link";
}

// Displays the persistent application header and primary navigation links.
export default function Header() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand">
          <strong>Cluster Codex</strong>
          <span className="brand-subtitle">Local-first Kubernetes troubleshooting</span>
        </div>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/" className={navClass(pathname === "/")}>
            Current Issues
          </Link>
          <Link href="/resources" className={navClass(pathname === "/resources")}>
            Resource Explorer
          </Link>
        </nav>
      </div>
    </header>
  );
}
