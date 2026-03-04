/**
 * Renders a static fallback page for unexpected rendering failures.
 */
// Shows a generic error message when page rendering fails.
export default function ErrorPage() {
  return (
    <main style={{ padding: "40px" }}>
      <h1>Unexpected Error</h1>
      <p>Cluster Codex hit an unexpected error while rendering this page.</p>
    </main>
  );
}
