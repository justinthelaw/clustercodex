import { Router } from "express";
import {
  AppsV1Api,
  BatchV1Api,
  CoreV1Api,
  KubeConfig,
  NetworkingV1Api,
  ApiextensionsV1Api
} from "@kubernetes/client-node";
import { getPolicyForUser, filterResourcesByPolicy } from "../services/access-policy.js";

const router = Router();

router.get("/policy", (req, res) => {
  const policy = getPolicyForUser(req.user);
  if (!policy) {
    return res.json({ namespaceAllowList: [], kindAllowList: [] });
  }
  return res.json(policy);
});

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

  const policy = getPolicyForUser(req.user);
  if (!policy) {
    return res.json([]);
  }

  if (!policy.kindAllowList.includes("*") && !policy.kindAllowList.includes(kind)) {
    return res.json([]);
  }

  if (namespace && !policy.namespaceAllowList.includes("*") && !policy.namespaceAllowList.includes(namespace)) {
    return res.json([]);
  }

  const kc = buildKubeConfig();
  const core = kc.makeApiClient(CoreV1Api);
  const apps = kc.makeApiClient(AppsV1Api);
  const batch = kc.makeApiClient(BatchV1Api);
  const networking = kc.makeApiClient(NetworkingV1Api);
  const apix = kc.makeApiClient(ApiextensionsV1Api);

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
          filterResourcesByPolicy(items.map((pod: any) => ({
            type: "Pod",
            name: pod.metadata?.name || "unknown",
            namespace: pod.metadata?.namespace || "",
            status: formatPodStatus(pod),
            restarts: countRestarts(pod),
            node: pod.spec?.nodeName || ""
          })), req.user)
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
          filterResourcesByPolicy(items.map((deploy: any) => ({
            type: "Deployment",
            name: deploy.metadata?.name || "unknown",
            namespace: deploy.metadata?.namespace || "",
            ready: `${deploy.status?.readyReplicas || 0}/${deploy.status?.replicas || 0}`,
            updated: deploy.status?.updatedReplicas || 0,
            available: deploy.status?.availableReplicas || 0
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list deployments", err);
        return res.json([]);
      });
  }

  if (lower === "daemonset") {
    const list = namespace
      ? apps.listNamespacedDaemonSet({ namespace })
      : apps.listDaemonSetForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((ds: any) => ({
            type: "DaemonSet",
            name: ds.metadata?.name || "unknown",
            namespace: ds.metadata?.namespace || "",
            ready: `${ds.status?.numberReady || 0}/${ds.status?.desiredNumberScheduled || 0}`,
            updated: ds.status?.updatedNumberScheduled || 0,
            available: ds.status?.numberAvailable || 0
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list daemonsets", err);
        return res.json([]);
      });
  }

  if (lower === "replicaset") {
    const list = namespace
      ? apps.listNamespacedReplicaSet({ namespace })
      : apps.listReplicaSetForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((rs: any) => ({
            type: "ReplicaSet",
            name: rs.metadata?.name || "unknown",
            namespace: rs.metadata?.namespace || "",
            ready: `${rs.status?.readyReplicas || 0}/${rs.status?.replicas || 0}`,
            updated: rs.status?.availableReplicas || 0,
            available: rs.status?.availableReplicas || 0
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list replicasets", err);
        return res.json([]);
      });
  }

  if (lower === "statefulset") {
    const list = namespace
      ? apps.listNamespacedStatefulSet({ namespace })
      : apps.listStatefulSetForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((ss: any) => ({
            type: "StatefulSet",
            name: ss.metadata?.name || "unknown",
            namespace: ss.metadata?.namespace || "",
            ready: `${ss.status?.readyReplicas || 0}/${ss.status?.replicas || 0}`,
            updated: ss.status?.updatedReplicas || 0,
            available: ss.status?.currentReplicas || 0
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list statefulsets", err);
        return res.json([]);
      });
  }

  if (lower === "job") {
    const list = namespace
      ? batch.listNamespacedJob({ namespace })
      : batch.listJobForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((job: any) => ({
            type: "Job",
            name: job.metadata?.name || "unknown",
            namespace: job.metadata?.namespace || "",
            status: job.status?.succeeded ? "Complete" : job.status?.failed ? "Failed" : "Running",
            completions: job.spec?.completions || 0
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list jobs", err);
        return res.json([]);
      });
  }

  if (lower === "cronjob") {
    const list = namespace
      ? batch.listNamespacedCronJob({ namespace })
      : batch.listCronJobForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((cj: any) => ({
            type: "CronJob",
            name: cj.metadata?.name || "unknown",
            namespace: cj.metadata?.namespace || "",
            schedule: cj.spec?.schedule || "",
            suspend: Boolean(cj.spec?.suspend)
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list cronjobs", err);
        return res.json([]);
      });
  }

  if (lower === "service") {
    const list = namespace
      ? core.listNamespacedService({ namespace })
      : core.listServiceForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((svc: any) => ({
            type: "Service",
            name: svc.metadata?.name || "unknown",
            namespace: svc.metadata?.namespace || "",
            serviceType: svc.spec?.type || "",
            clusterIP: svc.spec?.clusterIP || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list services", err);
        return res.json([]);
      });
  }

  if (lower === "ingress") {
    const list = namespace
      ? networking.listNamespacedIngress({ namespace })
      : networking.listIngressForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((ing: any) => ({
            type: "Ingress",
            name: ing.metadata?.name || "unknown",
            namespace: ing.metadata?.namespace || "",
            className: ing.spec?.ingressClassName || "",
            hosts: (ing.spec?.rules || []).map((rule: any) => rule.host).filter(Boolean).join(",")
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list ingresses", err);
        return res.json([]);
      });
  }

  if (lower === "namespace") {
    return core
      .listNamespace()
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((ns: any) => ({
            type: "Namespace",
            name: ns.metadata?.name || "unknown",
            status: ns.status?.phase || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list namespaces", err);
        return res.json([]);
      });
  }

  if (lower === "configmap") {
    const list = namespace
      ? core.listNamespacedConfigMap({ namespace })
      : core.listConfigMapForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((cm: any) => ({
            type: "ConfigMap",
            name: cm.metadata?.name || "unknown",
            namespace: cm.metadata?.namespace || "",
            dataKeys: Object.keys(cm.data || {}).length
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list configmaps", err);
        return res.json([]);
      });
  }

  if (lower === "secret") {
    const list = namespace
      ? core.listNamespacedSecret({ namespace })
      : core.listSecretForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((secret: any) => ({
            type: "Secret",
            name: secret.metadata?.name || "unknown",
            namespace: secret.metadata?.namespace || "",
            secretType: secret.type || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list secrets", err);
        return res.json([]);
      });
  }

  if (lower === "serviceaccount") {
    const list = namespace
      ? core.listNamespacedServiceAccount({ namespace })
      : core.listServiceAccountForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((sa: any) => ({
            type: "ServiceAccount",
            name: sa.metadata?.name || "unknown",
            namespace: sa.metadata?.namespace || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list serviceaccounts", err);
        return res.json([]);
      });
  }

  if (lower === "persistentvolume") {
    return core
      .listPersistentVolume()
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((pv: any) => ({
            type: "PersistentVolume",
            name: pv.metadata?.name || "unknown",
            status: pv.status?.phase || "",
            capacity: pv.spec?.capacity?.storage || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list persistentvolumes", err);
        return res.json([]);
      });
  }

  if (lower === "persistentvolumeclaim") {
    const list = namespace
      ? core.listNamespacedPersistentVolumeClaim({ namespace })
      : core.listPersistentVolumeClaimForAllNamespaces();
    return list
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((pvc: any) => ({
            type: "PersistentVolumeClaim",
            name: pvc.metadata?.name || "unknown",
            namespace: pvc.metadata?.namespace || "",
            status: pvc.status?.phase || "",
            capacity: pvc.status?.capacity?.storage || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list persistentvolumeclaims", err);
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
          filterResourcesByPolicy(items.map((node: any) => ({
            type: "Node",
            name: node.metadata?.name || "unknown",
            status:
              node.status?.conditions?.find((c: any) => c.type === "Ready")?.status === "True"
                ? "Ready"
                : "NotReady",
            roles: nodeRoles(node),
            version: node.status?.nodeInfo?.kubeletVersion || ""
          })), req.user)
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
          filterResourcesByPolicy(items.map((event: any) => ({
            type: "Event",
            namespace: event.metadata?.namespace || "",
            reason: event.reason || "",
            message: event.message || "",
            involvedObject: `${event.involvedObject?.kind || ""}/${event.involvedObject?.name || ""}`.replace(
              /^\/$/,
              ""
            ),
            lastTimestamp: eventTime(event)
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list events", err);
        return res.json([]);
      });
  }

  if (lower === "crd" || lower === "customresourcedefinition") {
    return apix
      .listCustomResourceDefinition()
      .then((response: any) => {
        const raw = response?.body ?? response;
        const items = raw?.items || [];
        return res.json(
          filterResourcesByPolicy(items.map((crd: any) => ({
            type: "CustomResourceDefinition",
            name: crd.metadata?.name || "unknown",
            scope: crd.spec?.scope || "",
            group: crd.spec?.group || ""
          })), req.user)
        );
      })
      .catch((err: any) => {
        console.warn("Failed to list CRDs", err);
        return res.json([]);
      });
  }

  return res.json([]);
});

export default router;
