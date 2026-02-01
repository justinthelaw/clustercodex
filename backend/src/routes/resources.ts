import { Router } from "express";
import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const router = Router();
const execFileAsync = promisify(execFile);

function buildKubeConfig(): KubeConfig {
  const kc = new KubeConfig();
  const kubeconfigPath = process.env.KUBECONFIG;
  if (kubeconfigPath) {
    kc.loadFromFile(kubeconfigPath.replace("~", process.env.HOME || ""));
  } else {
    kc.loadFromDefault();
  }

  const context = process.env.KUBE_CONTEXT;
  if (context) {
    kc.setCurrentContext(context);
  }

  return kc;
}

function formatPodStatus(pod: any): string {
  const status = pod.status?.phase || "Unknown";
  const waiting =
    pod.status?.containerStatuses?.find((c: any) => c.state?.waiting)?.state?.waiting?.reason;
  const terminated =
    pod.status?.containerStatuses?.find((c: any) => c.state?.terminated)?.state?.terminated?.reason;
  return waiting || terminated || status;
}

function countRestarts(pod: any): number {
  return (pod.status?.containerStatuses || []).reduce(
    (sum: number, c: any) => sum + (c.restartCount || 0),
    0
  );
}

function nodeRoles(node: any): string {
  const labels = node.metadata?.labels || {};
  const roles = Object.keys(labels)
    .filter((key) => key.startsWith("node-role.kubernetes.io/"))
    .map((key) => key.replace("node-role.kubernetes.io/", "") || "worker");
  return roles.length ? roles.join(",") : "worker";
}

function eventTime(event: any): string {
  return (
    event.lastTimestamp ||
    event.eventTime ||
    event.firstTimestamp ||
    event.metadata?.creationTimestamp ||
    ""
  );
}

function safeResourceName(value: string): string | null {
  if (!value) return null;
  if (!/^[a-zA-Z0-9.\-\/]+$/.test(value)) return null;
  return value;
}

function formatAge(timestamp?: string): string {
  if (!timestamp) return "";
  const created = Date.parse(timestamp);
  if (Number.isNaN(created)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

async function listApiResources(): Promise<any[]> {
  const { stdout } = await execFileAsync("kubectl", ["api-resources", "-o", "wide", "--no-headers"]);
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) return null;
      const verbs = parts[parts.length - 1];
      const kind = parts[parts.length - 2];
      const namespaced = parts[parts.length - 3];
      const apiVersion = parts[parts.length - 4];
      const name = parts[0];
      const shortNames = parts.slice(1, parts.length - 4).join(",") || "";
      return {
        name,
        shortNames,
        apiVersion,
        namespaced: namespaced.toLowerCase() === "true",
        kind,
        verbs
      };
    })
    .filter(Boolean);
}

async function listResourceInstances(resource: string, namespace?: string) {
  const args = ["get", resource];
  if (namespace) {
    args.push("-n", namespace);
  } else {
    args.push("-A");
  }
  args.push("-o", "json");
  const { stdout } = await execFileAsync("kubectl", args);
  const parsed = JSON.parse(stdout);
  const items = parsed?.items || [];
  return items.map((item: any) => ({
    apiVersion: item.apiVersion || "",
    kind: item.kind || "",
    name: item.metadata?.name || "unknown",
    namespace: item.metadata?.namespace || "",
    age: formatAge(item.metadata?.creationTimestamp)
  }));
}

router.get("/kinds", async (_req, res) => {
  try {
    const resources = await listApiResources();
    return res.json(resources);
  } catch (err) {
    console.warn("Failed to list api-resources", err);
    return res.json([]);
  }
});

router.get("/list", async (req, res) => {
  const resource = safeResourceName(String(req.query.resource || ""));
  const namespace = String(req.query.namespace || "");
  if (!resource) {
    return res.status(400).json({
      error: "Missing or invalid query param: resource",
      code: "VALIDATION_ERROR",
      details: { field: "resource" }
    });
  }

  try {
    const items = await listResourceInstances(resource, namespace || undefined);
    return res.json(items);
  } catch (err) {
    console.warn("Failed to list resource instances", err);
    return res.json([]);
  }
});

router.get("/", (req, res) => {
  const kind = String(req.query.kind || "");
  const namespace = String(req.query.namespace || "");
  if (!kind) {
    return res.status(400).json({
      error: "Missing query param: kind",
      code: "VALIDATION_ERROR",
      details: { field: "kind" }
    });
  }

  const kc = buildKubeConfig();
  const core = kc.makeApiClient(CoreV1Api);
  const apps = kc.makeApiClient(AppsV1Api);

  const lower = kind.toLowerCase();

  if (lower === "pod") {
    const list = namespace
      ? core.listNamespacedPod({ namespace })
      : core.listPodForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          items.map((pod: any) => ({
            type: "Pod",
            name: pod.metadata?.name || "unknown",
            namespace: pod.metadata?.namespace || "",
            status: formatPodStatus(pod),
            restarts: countRestarts(pod),
            node: pod.spec?.nodeName || ""
          }))
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list pods", err);
        return res.json([]);
      });
  }

  if (lower === "deployment") {
    const list = namespace
      ? apps.listNamespacedDeployment({ namespace })
      : apps.listDeploymentForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          items.map((deploy: any) => ({
            type: "Deployment",
            name: deploy.metadata?.name || "unknown",
            namespace: deploy.metadata?.namespace || "",
            ready: `${deploy.status?.readyReplicas || 0}/${deploy.status?.replicas || 0}`,
            updated: deploy.status?.updatedReplicas || 0,
            available: deploy.status?.availableReplicas || 0
          }))
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list deployments", err);
        return res.json([]);
      });
  }

  if (lower === "node") {
    return core
      .listNode()
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          items.map((node: any) => ({
            type: "Node",
            name: node.metadata?.name || "unknown",
            status:
              node.status?.conditions?.find((c: any) => c.type === "Ready")?.status === "True"
                ? "Ready"
                : "NotReady",
            roles: nodeRoles(node),
            version: node.status?.nodeInfo?.kubeletVersion || ""
          }))
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list nodes", err);
        return res.json([]);
      });
  }

  if (lower === "event") {
    const list = namespace
      ? core.listNamespacedEvent({ namespace })
      : core.listEventForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          items.map((event: any) => ({
            type: "Event",
            namespace: event.metadata?.namespace || "",
            reason: event.reason || "",
            message: event.message || "",
            involvedObject: `${event.involvedObject?.kind || ""}/${event.involvedObject?.name || ""}`.replace(
              /^\/$/,
              ""
            ),
            lastTimestamp: eventTime(event)
          }))
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list events", err);
        return res.json([]);
      });
  }

  return res.json([]);
});

export default router;
