"use client";

/**
 * Provides tabbed browsing of common Kubernetes resources with kind-specific tables.
 */
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listResources } from "@/lib/k8sClient";
import type { ResourceItem, ResourceKind } from "@/lib/types";

type Tab = {
  label: string;
  kind: ResourceKind;
};

type Column = {
  header: string;
  value: (item: ResourceItem, index: number) => string;
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

/** Normalizes mixed-value resource fields into display-safe strings. */
function getValue(item: ResourceItem, key: string): string {
  const value = item[key];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/** Derives stable row keys for rendering resource tables. */
function rowKey(kind: ResourceKind, item: ResourceItem, index: number): string {
  const namespace = getValue(item, "namespace");
  const name = getValue(item, "name");

  if (namespace && name) {
    return `${namespace}-${name}`;
  }
  if (name) {
    return `${kind}-${name}`;
  }
  if (kind === "Event") {
    return `${getValue(item, "involvedObject")}-${index}`;
  }
  return `${kind}-${index}`;
}

/** Defines column layouts per Kubernetes resource kind. */
const columnsByKind: Record<ResourceKind, Column[]> = {
  Pod: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Status", value: (item) => getValue(item, "status") },
    { header: "Restarts", value: (item) => getValue(item, "restarts") },
    { header: "Node", value: (item) => getValue(item, "node") }
  ],
  Deployment: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Ready", value: (item) => getValue(item, "ready") },
    { header: "Updated", value: (item) => getValue(item, "updated") },
    { header: "Available", value: (item) => getValue(item, "available") }
  ],
  DaemonSet: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Ready", value: (item) => getValue(item, "ready") },
    { header: "Updated", value: (item) => getValue(item, "updated") },
    { header: "Available", value: (item) => getValue(item, "available") }
  ],
  ReplicaSet: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Ready", value: (item) => getValue(item, "ready") },
    { header: "Updated", value: (item) => getValue(item, "updated") },
    { header: "Available", value: (item) => getValue(item, "available") }
  ],
  StatefulSet: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Ready", value: (item) => getValue(item, "ready") },
    { header: "Updated", value: (item) => getValue(item, "updated") },
    { header: "Available", value: (item) => getValue(item, "available") }
  ],
  Job: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Status", value: (item) => getValue(item, "status") },
    { header: "Completions", value: (item) => getValue(item, "completions") }
  ],
  CronJob: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Schedule", value: (item) => getValue(item, "schedule") },
    { header: "Suspended", value: (item) => (getValue(item, "suspend") === "true" ? "Yes" : "No") }
  ],
  Service: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Service Type", value: (item) => getValue(item, "serviceType") },
    { header: "Cluster IP", value: (item) => getValue(item, "clusterIP") }
  ],
  Ingress: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Class", value: (item) => getValue(item, "className") },
    { header: "Hosts", value: (item) => getValue(item, "hosts") }
  ],
  Namespace: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Status", value: (item) => getValue(item, "status") }
  ],
  ConfigMap: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Keys", value: (item) => getValue(item, "dataKeys") }
  ],
  Secret: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Secret Type", value: (item) => getValue(item, "secretType") }
  ],
  ServiceAccount: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") }
  ],
  PersistentVolume: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Status", value: (item) => getValue(item, "status") },
    { header: "Capacity", value: (item) => getValue(item, "capacity") }
  ],
  PersistentVolumeClaim: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Status", value: (item) => getValue(item, "status") },
    { header: "Capacity", value: (item) => getValue(item, "capacity") }
  ],
  CustomResourceDefinition: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Scope", value: (item) => getValue(item, "scope") },
    { header: "Group", value: (item) => getValue(item, "group") }
  ],
  Node: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Name", value: (item) => getValue(item, "name") },
    { header: "Status", value: (item) => getValue(item, "status") },
    { header: "Roles", value: (item) => getValue(item, "roles") },
    { header: "Version", value: (item) => getValue(item, "version") }
  ],
  Event: [
    { header: "Type", value: (item) => getValue(item, "type") },
    { header: "Namespace", value: (item) => getValue(item, "namespace") },
    { header: "Reason", value: (item) => getValue(item, "reason") },
    { header: "Message", value: (item) => getValue(item, "message") },
    { header: "Involved", value: (item) => getValue(item, "involvedObject") },
    {
      header: "Last Seen",
      value: (item) => {
        const timestamp = getValue(item, "lastTimestamp");
        return timestamp ? new Date(timestamp).toLocaleString() : "";
      }
    }
  ]
};

/** Renders resource data with tab-based kind selection and table formatting. */
export default function ResourcesExplorer() {
  const [activeKind, setActiveKind] = useState<ResourceKind>("Node");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ResourceItem[]>([]);

  /** Reloads resources whenever the selected kind changes. */
  useEffect(() => {
    let mounted = true;

    /** Fetches current resource data and guards against unmounted updates. */
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

  const activeColumns = useMemo(() => columnsByKind[activeKind], [activeKind]);

  /** Chooses the appropriate table layout for the selected resource kind. */
  const renderTable = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-4 py-8 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading {activeKind.toLowerCase()}...
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/45">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              {activeColumns.map((column) => (
                <TableHead key={column.header}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={activeColumns.length} className="text-muted-foreground">
                  No resources found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={rowKey(activeKind, item, index)}>
                  {activeColumns.map((column) => (
                    <TableCell key={column.header}>{column.value(item, index)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="surface-glow">
      <CardHeader className="space-y-2">
        <CardTitle>Resource Explorer</CardTitle>
        <CardDescription>
          Browse live Kubernetes inventory by workload and cluster object kind.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap rounded-xl border border-border/60 bg-background/35">
          <div className="flex w-max items-center gap-2 p-2">
            {tabs.map((tab) => (
              <Button
                key={tab.kind}
                variant={activeKind === tab.kind ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveKind(tab.kind)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </ScrollArea>

        <ErrorBanner message={error} />

        {renderTable()}
      </CardContent>
    </Card>
  );
}
