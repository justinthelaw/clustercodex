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

  return res.json([]);
});

export default router;
