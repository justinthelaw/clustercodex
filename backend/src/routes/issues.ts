import { Router } from "express";
import { listK8sGPTIssues } from "../services/k8sgpt-client.js";
import { filterIssuesByPolicy } from "../services/access-policy.js";
import { dismissIssue, getDismissedForUser, restoreIssue } from "../services/dismissed-issues.js";

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

router.get("/", async (req, res) => {
  try {
    const issues = await listK8sGPTIssues();
    const filtered = filterIssuesByPolicy(issues, req.user);
    const dismissed = new Set(getDismissedForUser(req.user));
    return res.json(filtered.filter((issue) => !dismissed.has(issue.id)));
  } catch (err) {
    console.warn("Failed to load K8sGPT issues, falling back to mock data", err);
    const filtered = filterIssuesByPolicy(mockIssues, req.user);
    const dismissed = new Set(getDismissedForUser(req.user));
    return res.json(filtered.filter((issue) => !dismissed.has(issue.id)));
  }
});

router.get("/dismissed", async (req, res) => {
  try {
    const issues = await listK8sGPTIssues();
    const filtered = filterIssuesByPolicy(issues, req.user);
    const dismissed = new Set(getDismissedForUser(req.user));
    return res.json(filtered.filter((issue) => dismissed.has(issue.id)));
  } catch (err) {
    console.warn("Failed to load K8sGPT issues, falling back to mock data", err);
    const filtered = filterIssuesByPolicy(mockIssues, req.user);
    const dismissed = new Set(getDismissedForUser(req.user));
    return res.json(filtered.filter((issue) => dismissed.has(issue.id)));
  }
});

router.post("/dismiss", (req, res) => {
  const { issueId } = req.body || {};
  if (!issueId) {
    return res.status(400).json({
      error: "issueId is required",
      code: "VALIDATION_ERROR",
      details: {}
    });
  }
  dismissIssue(req.user, String(issueId));
  return res.json({ status: "ok" });
});

router.post("/restore", (req, res) => {
  const { issueId } = req.body || {};
  if (!issueId) {
    return res.status(400).json({
      error: "issueId is required",
      code: "VALIDATION_ERROR",
      details: {}
    });
  }
  restoreIssue(req.user, String(issueId));
  return res.json({ status: "ok" });
});

export default router;
