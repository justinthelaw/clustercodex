import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ErrorBanner from "../components/ErrorBanner";

type Pod = {
  type: string;
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  node: string;
};

export default function Resources() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .get<Pod[]>("/api/resources?kind=Pod")
      .then((response) => {
        if (!mounted) return;
        setPods(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.error || "Failed to load resources");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card">
      <h2>Pods</h2>
      <ErrorBanner message={error} />
      {loading ? (
        <div>Loading pods...</div>
      ) : pods.length === 0 ? (
        <div>No pods found.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Namespace</th>
              <th>Status</th>
              <th>Restarts</th>
              <th>Node</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => (
              <tr key={`${pod.namespace}-${pod.name}`}>
                <td>{pod.type}</td>
                <td>{pod.name}</td>
                <td>{pod.namespace}</td>
                <td>{pod.status}</td>
                <td>{pod.restarts}</td>
                <td>{pod.node}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
