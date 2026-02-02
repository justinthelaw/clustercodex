import { Router } from "express";
import { listK8sGPTIssues } from "../services/k8sgpt-client.js";
import { getPolicyForUser, filterIssuesByPolicy } from "../services/access-policy.js";
import { mockIssues } from "../services/mock-issues.js";
import { isMockMode, generateCodexPlan } from "../services/codex-service.js";
import { getMockPlan } from "../services/codex-mock.js";
import type { CodexPlanIssue } from "../services/codex-types.js";

const router = Router();

async function loadIssuesForUser(user: any): Promise<CodexPlanIssue[]> {
  try {
    const issues = await listK8sGPTIssues();
    return filterIssuesByPolicy(issues, user);
  } catch (err) {
    console.warn("Failed to load K8sGPT issues for plans, using mock data", err);
    return filterIssuesByPolicy(mockIssues, user);
  }
}

function findIssueById(issues: CodexPlanIssue[], issueId: string): CodexPlanIssue | null {
  return issues.find((issue) => issue.id === issueId) || null;
}

router.post("/codex", async (req, res, next) => {
  try {
    const { issueId, userContext } = req.body || {};
    if (!issueId) {
      return res.status(400).json({
        error: "issueId is required",
        code: "VALIDATION_ERROR",
        details: { field: "issueId" }
      });
    }

    const issues = await loadIssuesForUser(req.user);
    const issue = findIssueById(issues, String(issueId));
    if (!issue) {
      return res.status(404).json({
        error: "Issue not found",
        code: "NOT_FOUND",
        details: {}
      });
    }

    const policy = getPolicyForUser(req.user) || { namespaceAllowList: [], kindAllowList: [] };
    const fallback = getMockPlan(issue);

    if (isMockMode()) {
      return res.json(fallback);
    }

    const plan = await generateCodexPlan(
      {
        issue,
        userContext: String(userContext || ""),
        allowList: policy
      },
      fallback
    );

    return res.json(plan);
  } catch (err) {
    return next(err);
  }
});

export default router;
