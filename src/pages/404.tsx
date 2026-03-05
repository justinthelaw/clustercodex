/**
 * Renders a simple fallback page for unmatched application routes.
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shows a static not-found message for unknown paths. */
export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>
            The requested route does not exist in this Cluster Codex workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
