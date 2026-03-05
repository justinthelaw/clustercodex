/**
 * Handles remediation plan generation requests with auth checks and safe fallbacks.
 */
import { NextResponse } from "next/server";
import { generateLocalPlan } from "@/lib/planGenerator";
import { getCodexAuthStatus } from "@/lib/server/codex/authStatus";
import {
  CodexAuthenticationError,
  isMissingCodexCliBinariesError
} from "@/lib/server/codex/errors";
import { generateLiveCodexPlan } from "@/lib/server/codex/livePlan";
import type { Issue, PlanGenerationResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanRequestBody = {
  issue?: Issue;
  contextSnapshot?: string;
  userContext?: string;
};

type ApiErrorBody = {
  error: string;
  details: string;
};

// Guards object-shape checks for request payload parsing.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Validates the minimum issue fields required for planning.
function isIssue(value: unknown): value is Issue {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.severity === "string" &&
    typeof value.kind === "string" &&
    typeof value.namespace === "string" &&
    typeof value.name === "string" &&
    typeof value.detectedAt === "string"
  );
}

// Merges captured cluster context with optional operator-provided context.
function mergedContext(contextSnapshot: string | undefined, userContext: string | undefined): string {
  return [contextSnapshot?.trim(), userContext?.trim()].filter(Boolean).join("\n\n");
}

// Builds a deterministic fallback response when live generation is unavailable.
function localFallback(issue: Issue, context: string, warning: string): PlanGenerationResponse {
  return {
    plan: generateLocalPlan(issue, context),
    provider: "local",
    model: "deterministic-fallback",
    warning
  };
}

// Flags E2E mode where fallback behavior is intentionally relaxed.
function deterministicFallbackEnabled(): boolean {
  return process.env.CLUSTERCODEX_E2E_MODE === "1";
}

// Normalizes API error payload format across route failures.
function errorResponse(status: number, error: string, details: string) {
  const body: ApiErrorBody = { error, details };
  return NextResponse.json(body, { status });
}

// Parses, validates, and generates a remediation plan for the requested issue.
export async function POST(request: Request) {
  let body: PlanRequestBody;
  try {
    body = (await request.json()) as PlanRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body"
      },
      { status: 400 }
    );
  }

  if (!isIssue(body.issue)) {
    return NextResponse.json(
      {
        error: "Missing or invalid issue payload"
      },
      { status: 400 }
    );
  }

  const issue = body.issue;
  const context = mergedContext(body.contextSnapshot, body.userContext);
  const e2eMode = deterministicFallbackEnabled();

  if (e2eMode) {
    return NextResponse.json(
      localFallback(issue, context, "E2E mode enabled. Using deterministic local plan generation.")
    );
  }

  const authStatus = await getCodexAuthStatus();

  if (!authStatus.authenticated) {
    const details = authStatus.details;
    if (isMissingCodexCliBinariesError(details)) {
      if (e2eMode) {
        return NextResponse.json(localFallback(issue, context, details));
      }
      return errorResponse(503, "Codex runtime unavailable", details);
    }

    if (e2eMode) {
      return NextResponse.json(localFallback(issue, context, details));
    }
    return errorResponse(401, "Codex authentication required", details);
  }

  try {
    const result = await generateLiveCodexPlan(issue, context);
    const response: PlanGenerationResponse = {
      plan: result.plan,
      provider: "codex",
      model: result.model
    };
    return NextResponse.json(response);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";

    if (error instanceof CodexAuthenticationError) {
      const authDetails = details || authStatus.details;
      if (e2eMode) {
        return NextResponse.json(
          localFallback(
            issue,
            context,
            `Codex authentication failed. ${authDetails}`
          )
        );
      }
      return errorResponse(401, "Codex authentication failed", authDetails);
    }

    if (e2eMode) {
      return NextResponse.json(
        localFallback(issue, context, `Live Codex plan generation failed. Falling back to local planner. ${details}`)
      );
    }

    if (isMissingCodexCliBinariesError(details)) {
      return errorResponse(503, "Codex runtime unavailable", details);
    }

    return errorResponse(502, "Live Codex plan generation failed", details);
  }
}
