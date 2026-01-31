import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ErrorBanner from "../components/ErrorBanner";

type Issue = {
  id: string;
  title: string;
  severity: string;
  kind: string;
  namespace: string;
  name: string;
  detectedAt: string;
};

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .get<Issue[]>("/api/issues")
      .then((response) => {
        if (!mounted) return;
        setIssues(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.error || "Failed to load issues");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card">
      <h2>Detected Issues</h2>
      <ErrorBanner message={error} />
      {loading ? (
        <div>Loading issues...</div>
      ) : issues.length === 0 ? (
        <div>No issues detected.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Kind</th>
              <th>Namespace</th>
              <th>Name</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td>{issue.title}</td>
                <td>{issue.severity}</td>
                <td>{issue.kind}</td>
                <td>{issue.namespace}</td>
                <td>{issue.name}</td>
                <td>{new Date(issue.detectedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
