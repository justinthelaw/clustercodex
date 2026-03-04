import { NextResponse } from "next/server";
import { generateLocalPlan } from "@/lib/plan-generator";
import {
  CodexAuthenticationError,
  getCodexAuthStatus,
  generateLiveCodexPlan
} from "@/lib/server/codex-plan";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function mergedContext(contextSnapshot: string | undefined, userContext: string | undefined): string {
  return [contextSnapshot?.trim(), userContext?.trim()].filter(Boolean).join("\n\n");
}

function localFallback(issue: Issue, context: string, warning: string): PlanGenerationResponse {
  return {
    plan: generateLocalPlan(issue, context),
    provider: "local",
    model: "deterministic-fallback",
    warning
  };
}

function deterministicFallbackEnabled(): boolean {
  return process.env.CLUSTERCODEX_E2E_MODE === "1";
}

function errorResponse(status: number, error: string, details: string) {
  const body: ApiErrorBody = { error, details };
  return NextResponse.json(body, { status });
}

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
  const authStatus = await getCodexAuthStatus();
  const e2eMode = deterministicFallbackEnabled();

  if (!authStatus.authenticated) {
    const loginHint = authStatus.loginCommand
      ? ` Run \`${authStatus.loginCommand}\` to authenticate and regenerate.`
      : "";
    const details = `${authStatus.details}${loginHint}`;
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
      const loginHint = authStatus.loginCommand
        ? ` Run \`${authStatus.loginCommand}\` to authenticate and regenerate.`
        : "";
      const authDetails = `${authStatus.details}${loginHint}`;
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

    return errorResponse(502, "Live Codex plan generation failed", details);
  }
}
