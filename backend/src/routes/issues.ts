import { Router } from "express";
import { listK8sGPTIssues } from "../services/k8sgpt-client.js";
import { filterIssuesByPolicy } from "../services/access-policy.js";
import {
  dismissIssue,
  getDismissedForUser,
  restoreIssue
} from "../services/dismissed-issues.js";
import { mockIssues } from "../services/mock-issues.js";

const router = Router();


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
