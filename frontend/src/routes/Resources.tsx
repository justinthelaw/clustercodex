import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import ErrorBanner from "../components/ErrorBanner";

type ResourceItem = Record<string, any>;

type Tab = {
  label: string;
  kind: string;
};

const tabs: Tab[] = [
  { label: "Nodes", kind: "Node" },
  { label: "Deployments", kind: "Deployment" },
  { label: "DaemonSets", kind: "DaemonSet" },
  { label: "ReplicaSets", kind: "ReplicaSet" },
  { label: "StatefulSets", kind: "StatefulSet" },
  { label: "Jobs", kind: "Job" },
  { label: "CronJobs", kind: "CronJob" },
  { label: "Services", kind: "Service" },
  { label: "Ingresses", kind: "Ingress" },
  { label: "Namespaces", kind: "Namespace" },
  { label: "ConfigMaps", kind: "ConfigMap" },
  { label: "Secrets", kind: "Secret" },
  { label: "ServiceAccounts", kind: "ServiceAccount" },
  { label: "PersistentVolumes", kind: "PersistentVolume" },
  { label: "PersistentVolumeClaims", kind: "PersistentVolumeClaim" },
  { label: "CRDs", kind: "CustomResourceDefinition" },
  { label: "Pods", kind: "Pod" },
  { label: "Events", kind: "Event" }
];

export default function Resources() {
  const [activeKind, setActiveKind] = useState("Node");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [allowedKinds, setAllowedKinds] = useState<string[] | null>(null);

  const visibleTabs = useMemo(() => {
    if (!allowedKinds) return [];
    if (allowedKinds.includes("*")) return tabs;
    return tabs.filter((tab) => allowedKinds.includes(tab.kind));
  }, [allowedKinds]);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/resources/policy")
      .then((response) => {
        if (!mounted) return;
        const policy = response.data || {};
        setAllowedKinds(Array.isArray(policy.kindAllowList) ? policy.kindAllowList : []);
      })
      .catch(() => {
        if (!mounted) return;
        setAllowedKinds([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!allowedKinds) return;
    if (!visibleTabs.length) {
      setActiveKind("");
      return;
    }
    if (!visibleTabs.find((tab) => tab.kind === activeKind)) {
      setActiveKind(visibleTabs[0].kind);
    }
  }, [allowedKinds, visibleTabs, activeKind]);

  useEffect(() => {
    let mounted = true;
    if (!activeKind) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    api
      .get(`/api/resources?kind=${activeKind}`)
      .then((response) => {
        if (!mounted) return;
        setItems(response.data);
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

  const renderTable = () => {
    if (loading) return <div>Loading {activeKind.toLowerCase()}...</div>;

    switch (activeKind) {
      case "Pod":
        return (
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No resources found.</td>
                </tr>
              ) : (
                items.map((pod) => (
                  <tr key={`${pod.namespace}-${pod.name}`}>
                    <td>{pod.type}</td>
                    <td>{pod.name}</td>
                    <td>{pod.namespace}</td>
                    <td>{pod.status}</td>
                    <td>{pod.restarts}</td>
                    <td>{pod.node}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Deployment":
      case "DaemonSet":
      case "ReplicaSet":
      case "StatefulSet":
        return (
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No resources found.</td>
                </tr>
              ) : (
                items.map((obj) => (
                  <tr key={`${obj.namespace}-${obj.name}`}>
                    <td>{obj.type}</td>
                    <td>{obj.name}</td>
                    <td>{obj.namespace}</td>
                    <td>{obj.ready}</td>
                    <td>{obj.updated}</td>
                    <td>{obj.available}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Job":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Status</th>
                <th>Completions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No resources found.</td>
                </tr>
              ) : (
                items.map((job) => (
                  <tr key={`${job.namespace}-${job.name}`}>
                    <td>{job.type}</td>
                    <td>{job.name}</td>
                    <td>{job.namespace}</td>
                    <td>{job.status}</td>
                    <td>{job.completions}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "CronJob":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Schedule</th>
                <th>Suspended</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No resources found.</td>
                </tr>
              ) : (
                items.map((cj) => (
                  <tr key={`${cj.namespace}-${cj.name}`}>
                    <td>{cj.type}</td>
                    <td>{cj.name}</td>
                    <td>{cj.namespace}</td>
                    <td>{cj.schedule}</td>
                    <td>{cj.suspend ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Service":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Service Type</th>
                <th>Cluster IP</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No resources found.</td>
                </tr>
              ) : (
                items.map((svc) => (
                  <tr key={`${svc.namespace}-${svc.name}`}>
                    <td>{svc.type}</td>
                    <td>{svc.name}</td>
                    <td>{svc.namespace}</td>
                    <td>{svc.serviceType}</td>
                    <td>{svc.clusterIP}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Ingress":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Class</th>
                <th>Hosts</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No resources found.</td>
                </tr>
              ) : (
                items.map((ing) => (
                  <tr key={`${ing.namespace}-${ing.name}`}>
                    <td>{ing.type}</td>
                    <td>{ing.name}</td>
                    <td>{ing.namespace}</td>
                    <td>{ing.className}</td>
                    <td>{ing.hosts}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Namespace":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3}>No resources found.</td>
                </tr>
              ) : (
                items.map((ns) => (
                  <tr key={ns.name}>
                    <td>{ns.type}</td>
                    <td>{ns.name}</td>
                    <td>{ns.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "ConfigMap":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Keys</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>No resources found.</td>
                </tr>
              ) : (
                items.map((cm) => (
                  <tr key={`${cm.namespace}-${cm.name}`}>
                    <td>{cm.type}</td>
                    <td>{cm.name}</td>
                    <td>{cm.namespace}</td>
                    <td>{cm.dataKeys}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Secret":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Secret Type</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>No resources found.</td>
                </tr>
              ) : (
                items.map((secret) => (
                  <tr key={`${secret.namespace}-${secret.name}`}>
                    <td>{secret.type}</td>
                    <td>{secret.name}</td>
                    <td>{secret.namespace}</td>
                    <td>{secret.secretType}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "ServiceAccount":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3}>No resources found.</td>
                </tr>
              ) : (
                items.map((sa) => (
                  <tr key={`${sa.namespace}-${sa.name}`}>
                    <td>{sa.type}</td>
                    <td>{sa.name}</td>
                    <td>{sa.namespace}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "PersistentVolume":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Status</th>
                <th>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>No resources found.</td>
                </tr>
              ) : (
                items.map((pv) => (
                  <tr key={pv.name}>
                    <td>{pv.type}</td>
                    <td>{pv.name}</td>
                    <td>{pv.status}</td>
                    <td>{pv.capacity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "PersistentVolumeClaim":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Status</th>
                <th>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No resources found.</td>
                </tr>
              ) : (
                items.map((pvc) => (
                  <tr key={`${pvc.namespace}-${pvc.name}`}>
                    <td>{pvc.type}</td>
                    <td>{pvc.name}</td>
                    <td>{pvc.namespace}</td>
                    <td>{pvc.status}</td>
                    <td>{pvc.capacity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "CustomResourceDefinition":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Scope</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>No resources found.</td>
                </tr>
              ) : (
                items.map((crd) => (
                  <tr key={crd.name}>
                    <td>{crd.type}</td>
                    <td>{crd.name}</td>
                    <td>{crd.scope}</td>
                    <td>{crd.group}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Node":
        return (
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No resources found.</td>
                </tr>
              ) : (
                items.map((node) => (
                  <tr key={node.name}>
                    <td>{node.type}</td>
                    <td>{node.name}</td>
                    <td>{node.status}</td>
                    <td>{node.roles}</td>
                    <td>{node.version}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      case "Event":
        return (
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No resources found.</td>
                </tr>
              ) : (
                items.map((event, idx) => (
                  <tr key={`${event.involvedObject}-${idx}`}>
                    <td>{event.type}</td>
                    <td>{event.namespace}</td>
                    <td>{event.reason}</td>
                    <td>{event.message}</td>
                    <td>{event.involvedObject}</td>
                    <td>{event.lastTimestamp ? new Date(event.lastTimestamp).toLocaleString() : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  return (
    <div className="card">
      <h2>Resource Explorer</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        {visibleTabs.map((tab) => (
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
      {allowedKinds && visibleTabs.length === 0 ? (
        <div>No resource types available.</div>
      ) : (
        renderTable()
      )}
    </div>
  );
}
