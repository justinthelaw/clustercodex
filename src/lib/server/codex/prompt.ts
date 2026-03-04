/**
 * Builds model prompt text for remediation planning with issue and operator context.
 */
import type { Issue } from "@/lib/types";

// Safely serializes arbitrary values for prompt embedding.
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Constructs the full planning prompt with constraints and context payloads.
export function buildPrompt(issue: Issue, mergedContext: string): string {
  const context = mergedContext.trim() || "No additional context provided.";

  return [
    "You are Cluster Codex, a senior Kubernetes SRE.",
    "Analyze the issue and produce a comprehensive, actionable remediation plan for operators.",
    "Return JSON only and follow the provided schema exactly.",
    "Requirements:",
    "- Assume this could be any cluster issue; infer likely root causes from evidence.",
    "- Prioritize safe, reversible mitigation first, then deeper fixes.",
    "- Include concrete kubectl commands when possible; otherwise set kubectl to null.",
    "- Every step must include validation and impact; include rollback when impact is not none.",
    "- Keep output concise and practical.",
    "",
    "Issue payload:",
    safeJson(issue),
    "",
    "Operator context:",
    context
  ].join("\n");
}
