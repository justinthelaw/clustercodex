import { Router } from "express";

const router = Router();

const mockPods = [
  {
    type: "Pod",
    name: "api-7f9d5",
    namespace: "default",
    status: "CrashLoopBackOff",
    restarts: 4,
    node: "k3d-clustercodex-server-0"
  },
  {
    type: "Pod",
    name: "worker-5c9b2",
    namespace: "default",
    status: "ImagePullBackOff",
    restarts: 0,
    node: "k3d-clustercodex-server-0"
  },
  {
    type: "Pod",
    name: "processor-6d7a1",
    namespace: "default",
    status: "OOMKilled",
    restarts: 2,
    node: "k3d-clustercodex-server-0"
  }
];

const mockDeployments = [
  {
    type: "Deployment",
    name: "api",
    namespace: "default",
    ready: "1/1",
    updated: 1,
    available: 1
  },
  {
    type: "Deployment",
    name: "worker",
    namespace: "default",
    ready: "0/1",
    updated: 0,
    available: 0
  }
];

const mockNodes = [
  {
    type: "Node",
    name: "k3d-clustercodex-server-0",
    status: "Ready",
    roles: "control-plane",
    version: "v1.28.x"
  },
  {
    type: "Node",
    name: "k3d-clustercodex-agent-0",
    status: "Ready",
    roles: "worker",
    version: "v1.28.x"
  }
];

const mockEvents = [
  {
    type: "Event",
    namespace: "default",
    reason: "Failed",
    message: "Failed to pull image \"doesnotexist.invalid/fake-image:latest\"",
    involvedObject: "Pod/broken-image-abc123",
    lastTimestamp: "2026-01-31T00:00:00Z"
  },
  {
    type: "Event",
    namespace: "default",
    reason: "BackOff",
    message: "Back-off pulling image \"doesnotexist.invalid/fake-image:latest\"",
    involvedObject: "Pod/broken-image-abc123",
    lastTimestamp: "2026-01-31T00:05:00Z"
  }
];

router.get("/", (req, res) => {
  const kind = String(req.query.kind || "");
  if (!kind) {
    return res.status(400).json({
      error: "Missing query param: kind",
      code: "VALIDATION_ERROR",
      details: { field: "kind" }
    });
  }

  if (kind.toLowerCase() === "pod") {
    return res.json(mockPods);
  }

  if (kind.toLowerCase() === "deployment") {
    return res.json(mockDeployments);
  }

  if (kind.toLowerCase() === "node") {
    return res.json(mockNodes);
  }

  if (kind.toLowerCase() === "event") {
    return res.json(mockEvents);
  }

  return res.json([]);
});

export default router;
