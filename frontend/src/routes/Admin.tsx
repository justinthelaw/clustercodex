import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ErrorBanner from "../components/ErrorBanner";

const allKinds = [
  "Pod",
  "Deployment",
  "DaemonSet",
  "ReplicaSet",
  "StatefulSet",
  "Job",
  "CronJob",
  "Service",
  "Ingress",
  "Namespace",
  "ConfigMap",
  "Secret",
  "ServiceAccount",
  "PersistentVolume",
  "PersistentVolumeClaim",
  "CustomResourceDefinition",
  "Node",
  "Event",
];

export default function Admin() {
  const [namespaceAllowList, setNamespaceAllowList] = useState("broken,default");
  const [kindAllowList, setKindAllowList] = useState("Pod,Deployment,Event");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/access-policy")
      .then((response) => {
        const policy = response.data || {};
        if (Array.isArray(policy.namespaceAllowList)) {
          setNamespaceAllowList(policy.namespaceAllowList.join(","));
        }
        if (Array.isArray(policy.kindAllowList)) {
          setKindAllowList(policy.kindAllowList.join(","));
        }
      })
      .catch(() => {
        // ignore on initial load
      });
  }, []);

  const handleSave = async () => {
    setStatus("");
    setError("");
    try {
      await api.post("/api/admin/access-policy", {
        namespaceAllowList: namespaceAllowList
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        kindAllowList: kindAllowList
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      });
      setStatus("Saved.");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save policy");
    }
  };

  return (
    <div className="card">
      <h2>Admin</h2>
      <p>Configure access policy for the demo user.</p>
      <ErrorBanner message={error} />
      <div className="form-field">
        <label htmlFor="namespaces">
          Namespace allow list (comma-separated)
        </label>
        <input
          id="namespaces"
          type="text"
          value={namespaceAllowList}
          onChange={(event) => setNamespaceAllowList(event.target.value)}
        />
      </div>
      <div className="form-field">
        <label htmlFor="kinds">Kind allow list (comma-separated)</label>
        <input
          id="kinds"
          type="text"
          value={kindAllowList}
          onChange={(event) => setKindAllowList(event.target.value)}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button className="button" onClick={handleSave}>
          Save policy
        </button>
        {status && <span className="status-inline">{status}</span>}
      </div>
    </div>
  );
}
