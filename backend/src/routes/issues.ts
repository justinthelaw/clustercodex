import { Router } from "express";

const router = Router();

const mockIssues = [
  {
    id: "k8sgpt:crashloop-1",
    title: "CrashLoopBackOff",
    severity: "high",
    kind: "Pod",
    namespace: "default",
    name: "api-7f9d5",
    detectedAt: "2026-01-31T00:00:00Z"
  },
  {
    id: "k8sgpt:imagepull-1",
    title: "ImagePullBackOff",
    severity: "medium",
    kind: "Pod",
    namespace: "default",
    name: "worker-5c9b2",
    detectedAt: "2026-01-31T00:00:00Z"
  },
  {
    id: "k8sgpt:oom-1",
    title: "OOMKilled",
    severity: "high",
    kind: "Pod",
    namespace: "default",
    name: "processor-6d7a1",
    detectedAt: "2026-01-31T00:00:00Z"
  }
];

router.get("/", (_req, res) => {
  res.json(mockIssues);
});

export default router;
