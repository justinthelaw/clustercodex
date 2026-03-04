"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { listResources } from "@/lib/k8s-client";
import type { ResourceItem, ResourceKind } from "@/lib/types";

type Tab = {
  label: string;
  kind: ResourceKind;
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

function getValue(item: ResourceItem, key: string): string {
  const value = item[key];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export default function ResourcesExplorer() {
  const [activeKind, setActiveKind] = useState<ResourceKind>("Node");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ResourceItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const resourceItems = await listResources(activeKind);
        if (!mounted) {
          return;
        }
        setItems(resourceItems);
      } catch {
        if (!mounted) {
          return;
        }
        setError(
          "Failed to load resources. Verify your kubeconfig and cluster read permissions are valid."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [activeKind]);

  const renderTable = () => {
    if (loading) {
      return <div>Loading {activeKind.toLowerCase()}...</div>;
    }

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
                  <tr key={`${getValue(pod, "namespace")}-${getValue(pod, "name")}`}>
                    <td>{getValue(pod, "type")}</td>
                    <td>{getValue(pod, "name")}</td>
                    <td>{getValue(pod, "namespace")}</td>
                    <td>{getValue(pod, "status")}</td>
                    <td>{getValue(pod, "restarts")}</td>
                    <td>{getValue(pod, "node")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "ready")}</td>
                    <td>{getValue(item, "updated")}</td>
                    <td>{getValue(item, "available")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "status")}</td>
                    <td>{getValue(item, "completions")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "schedule")}</td>
                    <td>{getValue(item, "suspend") === "true" ? "Yes" : "No"}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "serviceType")}</td>
                    <td>{getValue(item, "clusterIP")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "className")}</td>
                    <td>{getValue(item, "hosts")}</td>
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
                items.map((item) => (
                  <tr key={getValue(item, "name")}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "status")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "dataKeys")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "secretType")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
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
                items.map((item) => (
                  <tr key={getValue(item, "name")}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "status")}</td>
                    <td>{getValue(item, "capacity")}</td>
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
                items.map((item) => (
                  <tr key={`${getValue(item, "namespace")}-${getValue(item, "name")}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "status")}</td>
                    <td>{getValue(item, "capacity")}</td>
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
                items.map((item) => (
                  <tr key={getValue(item, "name")}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "scope")}</td>
                    <td>{getValue(item, "group")}</td>
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
                items.map((item) => (
                  <tr key={getValue(item, "name")}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "name")}</td>
                    <td>{getValue(item, "status")}</td>
                    <td>{getValue(item, "roles")}</td>
                    <td>{getValue(item, "version")}</td>
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
                items.map((item, index) => (
                  <tr key={`${getValue(item, "involvedObject")}-${index}`}>
                    <td>{getValue(item, "type")}</td>
                    <td>{getValue(item, "namespace")}</td>
                    <td>{getValue(item, "reason")}</td>
                    <td>{getValue(item, "message")}</td>
                    <td>{getValue(item, "involvedObject")}</td>
                    <td>
                      {getValue(item, "lastTimestamp")
                        ? new Date(getValue(item, "lastTimestamp")).toLocaleString()
                        : ""}
                    </td>
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
      <div className="button-row wrap">
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
      <div className="table-wrap">{renderTable()}</div>
    </div>
  );
}
