/**
 * Renders a static fallback page for unexpected rendering failures.
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shows a generic error message when page rendering fails. */
export default function ErrorPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle>Unexpected Error</CardTitle>
          <CardDescription>
            Cluster Codex hit an unexpected error while rendering this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/resources">Open Resource Explorer</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
