/**
 * Provides the shared application shell, metadata, and global styling for all routes.
 */
import type { Metadata } from "next";
import "@/app/globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Cluster Codex",
  description: "Local-first Kubernetes troubleshooting workspace"
};

/** Renders the site chrome and route content container. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <div className="relative min-h-screen overflow-x-clip">
          <div
            className="pointer-events-none absolute inset-0 opacity-65"
            aria-hidden
            style={{
              backgroundImage:
                "linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)",
              backgroundSize: "90px 90px"
            }}
          />
          <Header />
          <main className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6 md:px-6 lg:pt-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
