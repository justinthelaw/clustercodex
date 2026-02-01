import type { K8sGPTIssue } from "./k8sgpt-client.js";

export const mockIssues: K8sGPTIssue[] = [
  {
    id: "k8sgpt:crashloop-1",
    title: "CrashLoopBackOff",
    severity: "high",
    kind: "Pod",
    namespace: "default",
    name: "api-7f9d5",
    detectedAt: "2026-01-31T00:00:00Z",
    context: {
      kind: "Pod",
      name: "api-7f9d5",
      errorText: "Container exited with code 1.",
      eventsTable:
        "LAST SEEN\tTYPE\tREASON\tOBJECT\tMESSAGE\n" +
        "2026-01-31T00:00:00Z\tWarning\tBackOff\tPod/api-7f9d5\tBack-off restarting failed container",
      definition:
        "apiVersion: v1\n" +
        "kind: Pod\n" +
        "metadata:\n" +
        "  name: api-7f9d5\n" +
        "  namespace: default\n" +
        "spec:\n" +
        "  containers:\n" +
        "    - name: api\n" +
        "      image: ghcr.io/acme/api:1.2.3\n" +
        "      args:\n" +
        "        - start\n" +
        "status:\n" +
        "  phase: Running\n"
    }
  },
  {
    id: "k8sgpt:imagepull-1",
    title: "ImagePullBackOff",
    severity: "medium",
    kind: "Pod",
    namespace: "default",
    name: "worker-5c9b2",
    detectedAt: "2026-01-31T00:00:00Z",
    context: {
      kind: "Pod",
      name: "worker-5c9b2",
      errorText: "Failed to pull image from registry (404).",
      eventsTable:
        "LAST SEEN\tTYPE\tREASON\tOBJECT\tMESSAGE\n" +
        "2026-01-31T00:05:00Z\tWarning\tFailed\tPod/worker-5c9b2\tFailed to pull image",
      definition:
        "apiVersion: v1\n" +
        "kind: Pod\n" +
        "metadata:\n" +
        "  name: worker-5c9b2\n" +
        "  namespace: default\n" +
        "spec:\n" +
        "  containers:\n" +
        "    - name: worker\n" +
        "      image: ghcr.io/acme/worker:2.0.1\n" +
        "      env:\n" +
        "        - name: QUEUE\n" +
        "          value: default\n" +
        "status:\n" +
        "  phase: Pending\n"
    }
  },
  {
    id: "k8sgpt:oom-1",
    title: "OOMKilled",
    severity: "high",
    kind: "Pod",
    namespace: "default",
    name: "processor-6d7a1",
    detectedAt: "2026-01-31T00:00:00Z",
    context: {
      kind: "Pod",
      name: "processor-6d7a1",
      errorText: "Container exceeded memory limit and was terminated.",
      eventsTable:
        "LAST SEEN\tTYPE\tREASON\tOBJECT\tMESSAGE\n" +
        "2026-01-31T00:02:00Z\tWarning\tOOMKilled\tPod/processor-6d7a1\tContainer killed due to OOM",
      definition:
        "apiVersion: v1\n" +
        "kind: Pod\n" +
        "metadata:\n" +
        "  name: processor-6d7a1\n" +
        "  namespace: default\n" +
        "spec:\n" +
        "  containers:\n" +
        "    - name: processor\n" +
        "      image: ghcr.io/acme/processor:4.5.0\n" +
        "      resources:\n" +
        "        limits:\n" +
        "          memory: 256Mi\n" +
        "status:\n" +
        "  phase: Running\n"
    }
  }
];
