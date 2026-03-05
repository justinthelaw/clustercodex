/**
 * Builds model prompt text for remediation planning with issue and operator context.
 */
import type { Issue } from "@/lib/types";

const DEFAULT_CONTEXT_MAX_CHARS = 12000;

type PromptIssuePayload = Pick<
  Issue,
  "id" | "title" | "kind" | "namespace" | "name" | "detectedAt"
> & {
  context?: {
    kind: string;
    name: string;
    errorText: string;
  };
};

/** Parses positive integer env values with fallback behavior. */
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Safely serializes arbitrary values for prompt embedding. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Reduces issue payload size by keeping only fields needed for plan generation. */
function buildIssuePayload(issue: Issue): PromptIssuePayload {
  const payload: PromptIssuePayload = {
    id: issue.id,
    title: issue.title,
    kind: issue.kind,
    namespace: issue.namespace,
    name: issue.name,
    detectedAt: issue.detectedAt
  };

  if (issue.context) {
    payload.context = {
      kind: issue.context.kind,
      name: issue.context.name,
      errorText: issue.context.errorText
    };
  }

  return payload;
}

/** Caps large context payloads to keep latency predictable. */
function truncateContext(rawContext: string): string {
  const maxChars = readPositiveIntEnv("CODEX_PLAN_CONTEXT_MAX_CHARS", DEFAULT_CONTEXT_MAX_CHARS);

  if (rawContext.length <= maxChars) {
    return rawContext;
  }

  const omitted = rawContext.length - maxChars;
  return `${rawContext.slice(0, maxChars)}\n\n[Operator context truncated: omitted ${omitted} characters.]`;
}

/** Constructs the full planning prompt with constraints and context payloads. */
export function buildPrompt(issue: Issue, mergedContext: string): string {
  const context = truncateContext(mergedContext.trim() || "No additional context provided.");
  const issuePayload = buildIssuePayload(issue);

  return [
    "You are Cluster Codex, a senior Kubernetes SRE.",
    "Analyze the issue and produce a comprehensive, actionable remediation plan for operators.",
    "Return JSON only and follow the provided schema exactly.",
    "Requirements:",
    "- Assume this could be any cluster issue; infer likely root causes from evidence.",
    "- Prioritize safe, reversible mitigation first, then deeper fixes.",
    "- Include concrete kubectl commands when possible; otherwise set kubectl to null.",
    "- Every step must include validation and impact; include rollback when impact is not none.",
    "- Do not run shell commands or inspect repository files; reason only from the provided issue/context payloads.",
    "- Keep output concise and practical.",
    "",
    "Issue payload:",
    safeJson(issuePayload),
    "",
    "Operator context:",
    context
  ].join("\n");
}
