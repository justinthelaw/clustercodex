import { Router } from "express";

const router = Router();

const remediationPlan = {
  summary: "Pod is crash-looping due to invalid config.",
  assumptions: ["ConfigMap v2 was deployed recently."],
  riskLevel: "medium",
  steps: [
    {
      stepId: "step-1",
      description: "Check pod logs for stack trace and config errors.",
      kubectl: "kubectl logs api-7f9d5 -n default --previous",
      validation: "Log output shows the crash reason.",
      rollback: null,
      impact: "none"
    }
  ],
  fallback: "Rollback to the previous config if the issue is confirmed."
};

const longTermPlan = {
  summary: "Improve config validation and rollback safety.",
  rootCauseHypotheses: ["Config change introduced invalid env var."],
  evidenceToGather: ["Compare config versions", "Check deployment history"],
  recommendations: ["Add config validation CI step", "Implement canary deploys"],
  riskLevel: "low"
};

router.post("/remediation", (req, res) => {
  const { issueId } = req.body || {};
  if (!issueId) {
    return res.status(400).json({
      error: "issueId is required",
      code: "VALIDATION_ERROR",
      details: { field: "issueId" }
    });
  }

  return res.json(remediationPlan);
});

router.post("/long-term", (req, res) => {
  const { issueId } = req.body || {};
  if (!issueId) {
    return res.status(400).json({
      error: "issueId is required",
      code: "VALIDATION_ERROR",
      details: { field: "issueId" }
    });
  }

  return res.json(longTermPlan);
});

export default router;
