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

type Deployment = {
  type: string;
  name: string;
  namespace: string;
  ready: string;
  updated: number;
  available: number;
};

type Node = {
  type: string;
  name: string;
  status: string;
  roles: string;
  version: string;
};

type Event = {
  type: string;
  namespace: string;
  reason: string;
  message: string;
  involvedObject: string;
  lastTimestamp: string;
};

const tabs = [
  { label: "Pods", kind: "Pod" },
  { label: "Deployments", kind: "Deployment" },
  { label: "Nodes", kind: "Node" },
  { label: "Events", kind: "Event" }
];

export default function Resources() {
  const [activeKind, setActiveKind] = useState("Pod");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pods, setPods] = useState<Pod[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/api/resources?kind=${activeKind}`)
      .then((response) => {
        if (!mounted) return;
        if (activeKind === "Pod") setPods(response.data);
        if (activeKind === "Deployment") setDeployments(response.data);
        if (activeKind === "Node") setNodes(response.data);
        if (activeKind === "Event") setEvents(response.data);
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
  }, [activeKind]);

  return (
    <div className="card">
      <h2>Resource Explorer</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            className={`button ${activeKind === tab.kind ? "" : "secondary"}`}
            onClick={() => setActiveKind(tab.kind)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ErrorBanner message={error} />

      {loading ? (
        <div>Loading {activeKind.toLowerCase()}...</div>
      ) : activeKind === "Pod" ? (
        pods.length === 0 ? (
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
        )
      ) : activeKind === "Deployment" ? (
        deployments.length === 0 ? (
          <div>No deployments found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Ready</th>
                <th>Updated</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((deploy) => (
                <tr key={`${deploy.namespace}-${deploy.name}`}>
                  <td>{deploy.type}</td>
                  <td>{deploy.name}</td>
                  <td>{deploy.namespace}</td>
                  <td>{deploy.ready}</td>
                  <td>{deploy.updated}</td>
                  <td>{deploy.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : activeKind === "Node" ? (
        nodes.length === 0 ? (
          <div>No nodes found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.name}>
                  <td>{node.type}</td>
                  <td>{node.name}</td>
                  <td>{node.status}</td>
                  <td>{node.roles}</td>
                  <td>{node.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : events.length === 0 ? (
        <div>No events found.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Namespace</th>
              <th>Reason</th>
              <th>Message</th>
              <th>Involved</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, idx) => (
              <tr key={`${event.involvedObject}-${idx}`}>
                <td>{event.type}</td>
                <td>{event.namespace}</td>
                <td>{event.reason}</td>
                <td>{event.message}</td>
                <td>{event.involvedObject}</td>
                <td>{new Date(event.lastTimestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
