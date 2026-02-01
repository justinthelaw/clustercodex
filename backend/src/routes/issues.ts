import { Router } from "express";
import { listK8sGPTIssues } from "../services/k8sgpt-client.js";

const router = Router();

const mockIssues = [
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
        "2026-01-31T00:00:00Z\tWarning\tBackOff\tPod/api-7f9d5\tBack-off restarting failed container"
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
        "2026-01-31T00:05:00Z\tWarning\tFailed\tPod/worker-5c9b2\tFailed to pull image"
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
        "2026-01-31T00:02:00Z\tWarning\tOOMKilled\tPod/processor-6d7a1\tContainer killed due to OOM"
    }
  }
];

router.get("/", async (_req, res) => {
  try {
    const issues = await listK8sGPTIssues();
    return res.json(issues);
  } catch (err) {
    console.warn("Failed to load K8sGPT issues, falling back to mock data", err);
    return res.json(mockIssues);
  }
});

export default router;
