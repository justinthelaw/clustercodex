"use client";

/**
 * Renders global navigation and brand context for top-level application routes.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Chooses the correct nav link styling for the current route. */
function navClass(isActive: boolean): string {
  return cn(
    buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }),
    "rounded-full border border-transparent px-4",
    isActive && "border-border/70 bg-secondary/85"
  );
}

/** Displays the persistent application header and primary navigation links. */
export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border/60 bg-card/80 p-2 text-primary shadow-md shadow-cyan-950/30">
            <ShieldAlert className="size-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-base font-semibold tracking-wide text-foreground">Cluster Codex</p>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Local-first Kubernetes troubleshooting
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-2" aria-label="Primary">
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
