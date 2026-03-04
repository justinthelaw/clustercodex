import { KubeConfig, CustomObjectsApi, CoreV1Api, KubernetesObjectApi, dumpYaml } from "@kubernetes/client-node";
const GROUP = "core.k8sgpt.ai";
const VERSION = "v1alpha1";
const PLURAL = "results";
function buildKubeConfig() {
    const kc = new KubeConfig();
    const kubeconfigPath = process.env.KUBECONFIG;
    if (kubeconfigPath) {
        kc.loadFromFile(kubeconfigPath.replace("~", process.env.HOME || ""));
    }
    else {
        kc.loadFromDefault();
    }
    const context = process.env.KUBE_CONTEXT;
    if (context) {
        kc.setCurrentContext(context);
    }
    return kc;
}
function normalizeSeverity(value) {
    if (!value)
        return "unknown";
    return value.toLowerCase();
}
function parseNamespacedName(rawName, fallbackNamespace) {
    if (!rawName) {
        return { namespace: fallbackNamespace, name: "unknown" };
    }
    if (rawName.includes("/")) {
        const [namespace, name] = rawName.split("/", 2);
        return { namespace, name };
    }
    return { namespace: fallbackNamespace, name: rawName };
}
function formatEventTime(event) {
    const value = event.lastTimestamp ||
        event.eventTime ||
        event.firstTimestamp ||
        event.metadata?.creationTimestamp ||
        "";
    return typeof value === "string" ? value : String(value);
}
function buildEventsTable(events) {
    if (!events || events.length === 0) {
        return "No events found.";
    }
    const rows = events.map((event) => {
        const time = formatEventTime(event);
        const ts = Date.parse(time);
        return {
            time,
            ts: Number.isNaN(ts) ? 0 : ts,
            type: event.type || "",
            reason: event.reason || "",
            object: `${event.involvedObject?.kind || ""}/${event.involvedObject?.name || ""}`.replace(/^\/$/, ""),
            message: (event.message || "").replace(/\s+/g, " ").trim()
        };
    });
    rows.sort((a, b) => b.ts - a.ts);
    const header = ["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"];
    const lines = [
        header.join("\t"),
        ...rows.map((row) => [row.time, row.type, row.reason, row.object, row.message].join("\t"))
    ];
    return lines.join("\n");
}
async function fetchEvents(api, namespace, kind, name) {
    if (!namespace || !kind || !name) {
        return "No events found.";
    }
    const fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`;
    const response = await api.listNamespacedEvent({ namespace, fieldSelector });
    const raw = response?.body ?? response;
    const items = raw?.items || [];
    return buildEventsTable(items);
}
function pickApiVersion(result, spec, status) {
    return (result?.apiVersion ||
        spec?.apiVersion ||
        status?.apiVersion ||
        result?.version ||
        spec?.version ||
        status?.version ||
        "");
}
function inferApiVersion(kind) {
    const normalized = (kind || "").toLowerCase();
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
async function fetchDefinition(api, apiVersion, kind, namespace, name) {
    if (!apiVersion || !kind || !name) {
        return "No definition found.";
    }
    try {
        const metadata = namespace ? { name, namespace } : { name };
        const resource = await api.read({
            apiVersion,
            kind,
            metadata
        });
        return dumpYaml(resource);
    }
    catch (err) {
        return "No definition found.";
    }
}
export async function listK8sGPTIssues() {
    const namespace = process.env.K8SGPT_NAMESPACE || "k8sgpt-operator-system";
    const kc = buildKubeConfig();
    const api = kc.makeApiClient(CustomObjectsApi);
    const core = kc.makeApiClient(CoreV1Api);
    const objectApi = KubernetesObjectApi.makeApiClient(kc);
    const response = await api.listNamespacedCustomObject({
        group: GROUP,
        version: VERSION,
        namespace,
        plural: PLURAL
    });
    const raw = response?.body ?? response;
    const items = raw?.items || [];
    if (!raw || !Array.isArray(items)) {
        return [];
    }
    const issuePromises = items.flatMap((item) => {
        const metadata = item.metadata || {};
        const spec = item.spec || {};
        const status = item.status || {};
        const results = status.results || [];
        const detectedAt = metadata.creationTimestamp || new Date().toISOString();
        if (Array.isArray(results) && results.length > 0) {
            return results.map(async (result, idx) => {
                const kind = result.kind || spec.kind || "Unknown";
                const apiVersion = pickApiVersion(result, spec, status) || inferApiVersion(kind);
                const nameRef = result.name || spec.name || metadata.name || "unknown";
                const parsed = parseNamespacedName(nameRef, result.namespace || spec.namespace || metadata.namespace || namespace);
                const eventsTable = await fetchEvents(core, parsed.namespace, kind, parsed.name);
                const definition = await fetchDefinition(objectApi, apiVersion, kind, parsed.namespace, parsed.name);
                return {
                    id: `${metadata.name || "result"}-${idx}`,
                    title: kind,
                    severity: normalizeSeverity(result.severity || result.severityScore || result.level),
                    kind,
                    namespace: parsed.namespace,
                    name: parsed.name,
                    detectedAt,
                    context: {
                        kind,
                        name: parsed.name,
                        errorText: (Array.isArray(result.error) ? result.error[0]?.text : result.error?.text) ||
                            (Array.isArray(spec.error) ? spec.error[0]?.text : spec.error?.text) ||
                            (Array.isArray(status.error) ? status.error[0]?.text : status.error?.text) ||
                            "",
                        eventsTable,
                        definition
                    }
                };
            });
        }
        return [
            (async () => {
                const kind = spec.kind || status.kind || "Unknown";
                const apiVersion = pickApiVersion({}, spec, status) || inferApiVersion(kind);
                const nameRef = spec.name || metadata.name || "unknown";
                const parsed = parseNamespacedName(nameRef, spec.namespace || metadata.namespace || namespace);
                const eventsTable = await fetchEvents(core, parsed.namespace, kind, parsed.name);
                const definition = await fetchDefinition(objectApi, apiVersion, kind, parsed.namespace, parsed.name);
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
                        errorText: (Array.isArray(spec.error) ? spec.error[0]?.text : spec.error?.text) ||
                            (Array.isArray(status.error) ? status.error[0]?.text : status.error?.text) ||
                            "",
                        eventsTable,
                        definition
                    }
                };
            })()
        ];
    });
    const resolved = await Promise.all(issuePromises);
    return resolved;
}
