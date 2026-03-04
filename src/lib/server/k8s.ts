import "server-only";

import {
  ApiextensionsV1Api,
  AppsV1Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  dumpYaml,
  KubeConfig,
  KubernetesObjectApi,
  NetworkingV1Api
} from "@kubernetes/client-node";
import type { Issue, ResourceItem, ResourceKind } from "@/lib/types";

type K8sGPTResultContext = {
  kind: string;
  name: string;
  errorText: string;
  eventsTable: string;
  definition?: string;
};

type K8sGPTIssue = Omit<Issue, "context"> & {
  context: K8sGPTResultContext;
};

type K8sResponse<T> = {
  body?: T;
} & T;

const K8SGPT_GROUP = "core.k8sgpt.ai";
const K8SGPT_VERSION = "v1alpha1";
const K8SGPT_PLURAL = "results";
const DEFAULT_K8SGPT_NAMESPACE = "k8sgpt-operator-system";

const RESOURCE_KINDS: ResourceKind[] = [
  "Node",
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
  "Pod",
  "Event"
];

function resolveK8sGPTNamespace(): string {
  return (
    process.env.K8SGPT_NAMESPACE ||
    process.env.NEXT_PUBLIC_K8SGPT_NAMESPACE ||
    DEFAULT_K8SGPT_NAMESPACE
  );
}

function buildKubeConfig(): KubeConfig {
  const kubeConfig = new KubeConfig();
  const kubeconfigPath = process.env.KUBECONFIG;

  if (kubeconfigPath) {
    kubeConfig.loadFromFile(kubeconfigPath.replace("~", process.env.HOME || ""));
  } else {
    kubeConfig.loadFromDefault();
  }

  const context = process.env.KUBE_CONTEXT;
  if (context) {
    kubeConfig.setCurrentContext(context);
  }

  return kubeConfig;
}

function normalizeSeverity(value: string | undefined): string {
  if (!value) {
    return "unknown";
  }
  return value.toLowerCase();
}

function parseNamespacedName(rawName: string | undefined, fallbackNamespace: string) {
  if (!rawName) {
    return { namespace: fallbackNamespace, name: "unknown" };
  }

  if (rawName.includes("/")) {
    const [namespace, name] = rawName.split("/", 2);
    return {
      namespace: namespace || fallbackNamespace,
      name: name || "unknown"
    };
  }

  return { namespace: fallbackNamespace, name: rawName };
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

function buildEventsTable(events: any[]): string {
  if (!events.length) {
    return "No events found.";
  }

  const rows = events
    .map((event) => {
      const time = eventTime(event);
      const timestamp = Date.parse(time);
      return {
        time,
        ts: Number.isNaN(timestamp) ? 0 : timestamp,
        type: event.type || "",
        reason: event.reason || "",
        object: `${event.involvedObject?.kind || ""}/${event.involvedObject?.name || ""}`.replace(
          /^\/$/,
          ""
        ),
        message: (event.message || "").replace(/\s+/g, " ").trim()
      };
    })
    .sort((a, b) => b.ts - a.ts);

  const header = ["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"];
  const lines = [header.join("\t")];

  for (const row of rows) {
    lines.push([row.time, row.type, row.reason, row.object, row.message].join("\t"));
  }

  return lines.join("\n");
}

async function fetchEventsTable(
  api: CoreV1Api,
  namespace: string,
  kind: string,
  name: string
): Promise<string> {
  if (!namespace || !kind || !name) {
    return "No events found.";
  }

  try {
    const fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`;
    const response = (await api.listNamespacedEvent({ namespace, fieldSelector })) as K8sResponse<{
      items?: any[];
    }>;
    const body = response.body ?? response;
    return buildEventsTable(body.items || []);
  } catch {
    return "No events found.";
  }
}

function pickApiVersion(result: any, spec: any, status: any): string {
  return (
    result?.apiVersion ||
    spec?.apiVersion ||
    status?.apiVersion ||
    result?.version ||
    spec?.version ||
    status?.version ||
    ""
  );
}

function inferApiVersion(kind: string): string {
  const normalized = kind.toLowerCase();

  const coreKinds = new Set([
    "pod",
    "service",
    "configmap",
    "secret",
    "namespace",
    "node",
    "serviceaccount",
    "persistentvolume",
    "persistentvolumeclaim",
    "event"
  ]);
  if (coreKinds.has(normalized)) {
    return "v1";
  }

  const appsKinds = new Set(["deployment", "replicaset", "statefulset", "daemonset"]);
  if (appsKinds.has(normalized)) {
    return "apps/v1";
  }

  const batchKinds = new Set(["job", "cronjob"]);
  if (batchKinds.has(normalized)) {
    return "batch/v1";
  }

  if (normalized === "ingress") {
    return "networking.k8s.io/v1";
  }

  if (normalized === "customresourcedefinition" || normalized === "crd") {
    return "apiextensions.k8s.io/v1";
  }

  return "";
}

async function fetchDefinition(
  api: KubernetesObjectApi,
  apiVersion: string,
  kind: string,
  namespace: string,
  name: string
): Promise<string> {
  if (!apiVersion || !kind || !name) {
    return "No definition found.";
  }

  try {
    const metadata = namespace ? { name, namespace } : { name };
    const resource = await api.read({ apiVersion, kind, metadata });
    return dumpYaml(resource);
  } catch {
    return "No definition found.";
  }
}

function extractErrorText(result: any, spec: any, status: any): string {
  return (
    (Array.isArray(result?.error) ? result.error[0]?.text : result?.error?.text) ||
    (Array.isArray(spec?.error) ? spec.error[0]?.text : spec?.error?.text) ||
    (Array.isArray(status?.error) ? status.error[0]?.text : status?.error?.text) ||
    ""
  );
}

async function listK8sGPTIssuesInternal(): Promise<K8sGPTIssue[]> {
  const namespace = resolveK8sGPTNamespace();
  const kubeConfig = buildKubeConfig();

  const api = kubeConfig.makeApiClient(CustomObjectsApi);
  const core = kubeConfig.makeApiClient(CoreV1Api);
  const objectApi = KubernetesObjectApi.makeApiClient(kubeConfig);

  const response = (await api.listNamespacedCustomObject({
    group: K8SGPT_GROUP,
    version: K8SGPT_VERSION,
    namespace,
    plural: K8SGPT_PLURAL
  })) as K8sResponse<{ items?: any[] }>;

  const body = response.body ?? response;
  const items = body.items || [];

  const issuePromises = items.flatMap((item: any) => {
    const metadata = item.metadata || {};
    const spec = item.spec || {};
    const status = item.status || {};
    const results = Array.isArray(status.results) ? status.results : [];
    const detectedAt = metadata.creationTimestamp || new Date().toISOString();

    if (results.length > 0) {
      return results.map(async (result: any, index: number) => {
        const kind = result.kind || spec.kind || "Unknown";
        const apiVersion = pickApiVersion(result, spec, status) || inferApiVersion(kind);
        const nameRef = result.name || spec.name || metadata.name || "unknown";
        const parsed = parseNamespacedName(
          nameRef,
          result.namespace || spec.namespace || metadata.namespace || namespace
        );
        const eventsTable = await fetchEventsTable(core, parsed.namespace, kind, parsed.name);
        const definition = await fetchDefinition(
          objectApi,
          apiVersion,
          kind,
          parsed.namespace,
          parsed.name
        );

        return {
          id: `${metadata.name || "result"}-${index}`,
          title: kind,
          severity: normalizeSeverity(result.severity || result.severityScore || result.level),
          kind,
          namespace: parsed.namespace,
          name: parsed.name,
          detectedAt,
          context: {
            kind,
            name: parsed.name,
            errorText: extractErrorText(result, spec, status),
            eventsTable,
            definition
          }
        } satisfies K8sGPTIssue;
      });
    }

    return [
      (async () => {
        const kind = spec.kind || status.kind || "Unknown";
        const apiVersion = pickApiVersion({}, spec, status) || inferApiVersion(kind);
        const nameRef = spec.name || metadata.name || "unknown";
        const parsed = parseNamespacedName(nameRef, spec.namespace || metadata.namespace || namespace);
        const eventsTable = await fetchEventsTable(core, parsed.namespace, kind, parsed.name);
        const definition = await fetchDefinition(
          objectApi,
          apiVersion,
          kind,
          parsed.namespace,
          parsed.name
        );

        return {
          id: metadata.name || "result",
          title: kind,
          severity: normalizeSeverity(status.severity || spec.severity),
          kind,
          namespace: parsed.namespace,
          name: parsed.name,
          detectedAt,
          context: {
            kind,
            name: parsed.name,
            errorText: extractErrorText({}, spec, status),
            eventsTable,
            definition
          }
        } satisfies K8sGPTIssue;
      })()
    ];
  });

  const resolved = await Promise.all(issuePromises);
  return resolved.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
}

function formatPodStatus(pod: any): string {
  const status = pod.status?.phase || "Unknown";
  const waiting =
    pod.status?.containerStatuses?.find((container: any) => container.state?.waiting)?.state
      ?.waiting?.reason;
  const terminated =
    pod.status?.containerStatuses?.find((container: any) => container.state?.terminated)?.state
      ?.terminated?.reason;

  return waiting || terminated || status;
}

function countRestarts(pod: any): number {
  return (pod.status?.containerStatuses || []).reduce(
    (sum: number, container: any) => sum + (container.restartCount || 0),
    0
  );
}

async function listFallbackIssuesFromPods(): Promise<Issue[]> {
  const kubeConfig = buildKubeConfig();
  const core = kubeConfig.makeApiClient(CoreV1Api);

  const response = (await core.listPodForAllNamespaces()) as K8sResponse<{ items?: any[] }>;
  const body = response.body ?? response;
  const pods = body.items || [];

  const issues: Issue[] = [];

  for (const pod of pods) {
    const name = pod.metadata?.name || "unknown";
    const namespace = pod.metadata?.namespace || "default";
    const status = formatPodStatus(pod);
    const problem =
      status === "Running" || status === "Succeeded" || status === "Completed" ? "" : status;

    if (!problem) {
      continue;
    }

    issues.push({
      id: `pod-${namespace}-${name}`,
      title: problem,
      severity: "medium",
      kind: "Pod",
      namespace,
      name,
      detectedAt: pod.metadata?.creationTimestamp || new Date().toISOString(),
      context: {
        kind: "Pod",
        name,
        errorText: `Pod status is ${problem}.`,
        eventsTable: "No events found.",
        definition: dumpYaml(pod)
      }
    });
  }

  return issues.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
}

function nodeRoles(node: any): string {
  const labels = node.metadata?.labels || {};
  const roles = Object.keys(labels)
    .filter((key) => key.startsWith("node-role.kubernetes.io/"))
    .map((key) => key.replace("node-role.kubernetes.io/", "") || "worker");
  return roles.length ? roles.join(",") : "worker";
}

function toBody<T>(response: K8sResponse<T>): T {
  return (response.body ?? response) as T;
}

function eventLastTimestamp(event: any): string {
  return (
    event.lastTimestamp ||
    event.eventTime ||
    event.firstTimestamp ||
    event.metadata?.creationTimestamp ||
    ""
  );
}

export async function listIssuesFromCluster(): Promise<Issue[]> {
  try {
    const issues = await listK8sGPTIssuesInternal();
    if (issues.length > 0) {
      return issues;
    }
    return await listFallbackIssuesFromPods();
  } catch {
    return await listFallbackIssuesFromPods();
  }
}

export function isResourceKind(value: string): value is ResourceKind {
  return RESOURCE_KINDS.includes(value as ResourceKind);
}

export async function listResourcesFromCluster(kind: ResourceKind): Promise<ResourceItem[]> {
  const kubeConfig = buildKubeConfig();
  const core = kubeConfig.makeApiClient(CoreV1Api);
  const apps = kubeConfig.makeApiClient(AppsV1Api);
  const batch = kubeConfig.makeApiClient(BatchV1Api);
  const networking = kubeConfig.makeApiClient(NetworkingV1Api);
  const apix = kubeConfig.makeApiClient(ApiextensionsV1Api);

  switch (kind) {
    case "Pod": {
      const body = toBody(await core.listPodForAllNamespaces());
      return (body.items || []).map((pod: any) => ({
        type: "Pod",
        name: pod.metadata?.name || "unknown",
        namespace: pod.metadata?.namespace || "",
        status: formatPodStatus(pod),
        restarts: countRestarts(pod),
        node: pod.spec?.nodeName || ""
      }));
    }
    case "Deployment": {
      const body = toBody(await apps.listDeploymentForAllNamespaces());
      return (body.items || []).map((deployment: any) => ({
        type: "Deployment",
        name: deployment.metadata?.name || "unknown",
        namespace: deployment.metadata?.namespace || "",
        ready: `${deployment.status?.readyReplicas || 0}/${deployment.status?.replicas || 0}`,
        updated: deployment.status?.updatedReplicas || 0,
        available: deployment.status?.availableReplicas || 0
      }));
    }
    case "DaemonSet": {
      const body = toBody(await apps.listDaemonSetForAllNamespaces());
      return (body.items || []).map((daemonSet: any) => ({
        type: "DaemonSet",
        name: daemonSet.metadata?.name || "unknown",
        namespace: daemonSet.metadata?.namespace || "",
        ready: `${daemonSet.status?.numberReady || 0}/${daemonSet.status?.desiredNumberScheduled || 0}`,
        updated: daemonSet.status?.updatedNumberScheduled || 0,
        available: daemonSet.status?.numberAvailable || 0
      }));
    }
    case "ReplicaSet": {
      const body = toBody(await apps.listReplicaSetForAllNamespaces());
      return (body.items || []).map((replicaSet: any) => ({
        type: "ReplicaSet",
        name: replicaSet.metadata?.name || "unknown",
        namespace: replicaSet.metadata?.namespace || "",
        ready: `${replicaSet.status?.readyReplicas || 0}/${replicaSet.status?.replicas || 0}`,
        updated: replicaSet.status?.availableReplicas || 0,
        available: replicaSet.status?.availableReplicas || 0
      }));
    }
    case "StatefulSet": {
      const body = toBody(await apps.listStatefulSetForAllNamespaces());
      return (body.items || []).map((statefulSet: any) => ({
        type: "StatefulSet",
        name: statefulSet.metadata?.name || "unknown",
        namespace: statefulSet.metadata?.namespace || "",
        ready: `${statefulSet.status?.readyReplicas || 0}/${statefulSet.status?.replicas || 0}`,
        updated: statefulSet.status?.updatedReplicas || 0,
        available: statefulSet.status?.currentReplicas || 0
      }));
    }
    case "Job": {
      const body = toBody(await batch.listJobForAllNamespaces());
      return (body.items || []).map((job: any) => ({
        type: "Job",
        name: job.metadata?.name || "unknown",
        namespace: job.metadata?.namespace || "",
        status: job.status?.succeeded ? "Complete" : job.status?.failed ? "Failed" : "Running",
        completions: job.spec?.completions || 0
      }));
    }
    case "CronJob": {
      const body = toBody(await batch.listCronJobForAllNamespaces());
      return (body.items || []).map((cronJob: any) => ({
        type: "CronJob",
        name: cronJob.metadata?.name || "unknown",
        namespace: cronJob.metadata?.namespace || "",
        schedule: cronJob.spec?.schedule || "",
        suspend: Boolean(cronJob.spec?.suspend)
      }));
    }
    case "Service": {
      const body = toBody(await core.listServiceForAllNamespaces());
      return (body.items || []).map((service: any) => ({
        type: "Service",
        name: service.metadata?.name || "unknown",
        namespace: service.metadata?.namespace || "",
        serviceType: service.spec?.type || "",
        clusterIP: service.spec?.clusterIP || ""
      }));
    }
    case "Ingress": {
      const body = toBody(await networking.listIngressForAllNamespaces());
      return (body.items || []).map((ingress: any) => ({
        type: "Ingress",
        name: ingress.metadata?.name || "unknown",
        namespace: ingress.metadata?.namespace || "",
        className: ingress.spec?.ingressClassName || "",
        hosts: (ingress.spec?.rules || [])
          .map((rule: any) => rule.host)
          .filter(Boolean)
          .join(",")
      }));
    }
    case "Namespace": {
      const body = toBody(await core.listNamespace());
      return (body.items || []).map((namespace: any) => ({
        type: "Namespace",
        name: namespace.metadata?.name || "unknown",
        status: namespace.status?.phase || ""
      }));
    }
    case "ConfigMap": {
      const body = toBody(await core.listConfigMapForAllNamespaces());
      return (body.items || []).map((configMap: any) => ({
        type: "ConfigMap",
        name: configMap.metadata?.name || "unknown",
        namespace: configMap.metadata?.namespace || "",
        dataKeys: Object.keys(configMap.data || {}).length
      }));
    }
    case "Secret": {
      const body = toBody(await core.listSecretForAllNamespaces());
      return (body.items || []).map((secret: any) => ({
        type: "Secret",
        name: secret.metadata?.name || "unknown",
        namespace: secret.metadata?.namespace || "",
        secretType: secret.type || ""
      }));
    }
    case "ServiceAccount": {
      const body = toBody(await core.listServiceAccountForAllNamespaces());
      return (body.items || []).map((serviceAccount: any) => ({
        type: "ServiceAccount",
        name: serviceAccount.metadata?.name || "unknown",
        namespace: serviceAccount.metadata?.namespace || ""
      }));
    }
    case "PersistentVolume": {
      const body = toBody(await core.listPersistentVolume());
      return (body.items || []).map((persistentVolume: any) => ({
        type: "PersistentVolume",
        name: persistentVolume.metadata?.name || "unknown",
        status: persistentVolume.status?.phase || "",
        capacity: persistentVolume.spec?.capacity?.storage || ""
      }));
    }
    case "PersistentVolumeClaim": {
      const body = toBody(await core.listPersistentVolumeClaimForAllNamespaces());
      return (body.items || []).map((persistentVolumeClaim: any) => ({
        type: "PersistentVolumeClaim",
        name: persistentVolumeClaim.metadata?.name || "unknown",
        namespace: persistentVolumeClaim.metadata?.namespace || "",
        status: persistentVolumeClaim.status?.phase || "",
        capacity: persistentVolumeClaim.status?.capacity?.storage || ""
      }));
    }
    case "CustomResourceDefinition": {
      const body = toBody(await apix.listCustomResourceDefinition());
      return (body.items || []).map((crd: any) => ({
        type: "CustomResourceDefinition",
        name: crd.metadata?.name || "unknown",
        scope: crd.spec?.scope || "",
        group: crd.spec?.group || ""
      }));
    }
    case "Node": {
      const body = toBody(await core.listNode());
      return (body.items || []).map((node: any) => ({
        type: "Node",
        name: node.metadata?.name || "unknown",
        status:
          node.status?.conditions?.find((condition: any) => condition.type === "Ready")?.status ===
          "True"
            ? "Ready"
            : "NotReady",
        roles: nodeRoles(node),
        version: node.status?.nodeInfo?.kubeletVersion || ""
      }));
    }
    case "Event": {
      const body = toBody(await core.listEventForAllNamespaces());
      return (body.items || [])
        .map((event: any) => ({
          type: "Event",
          namespace: event.metadata?.namespace || "",
          reason: event.reason || "",
          message: event.message || "",
          involvedObject: `${event.involvedObject?.kind || ""}/${event.involvedObject?.name || ""}`.replace(
            /^\/$/,
            ""
          ),
          lastTimestamp: eventLastTimestamp(event)
        }))
        .sort(
          (a, b) => Date.parse(String(b.lastTimestamp || "")) - Date.parse(String(a.lastTimestamp || ""))
        );
    }
    default:
      return [];
  }
}
