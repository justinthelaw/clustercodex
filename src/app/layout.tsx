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

// Renders the site chrome and route content container.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <Header />
          <main className="site-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
