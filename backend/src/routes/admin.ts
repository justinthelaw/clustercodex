import { Router } from "express";
import { getPolicyForUser, updatePolicyForUser } from "../services/access-policy.js";

const router = Router();

router.get("/access-policy", (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden",
      code: "FORBIDDEN",
      details: {}
    });
  }

  const policy = getPolicyForUser({ id: "user-basic", email: "user@clustercodex.local", role: "user" });
  return res.json(policy);
});

router.post("/access-policy", (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden",
      code: "FORBIDDEN",
      details: {}
    });
  }

  const { namespaceAllowList, kindAllowList } = req.body || {};
  if (!Array.isArray(namespaceAllowList) || !Array.isArray(kindAllowList)) {
    return res.status(400).json({
      error: "namespaceAllowList and kindAllowList are required",
      code: "VALIDATION_ERROR",
      details: {}
    });
  }

  updatePolicyForUser("user-basic", {
    namespaceAllowList,
    kindAllowList
  });

  return res.json({ status: "ok" });
});

export default router;
