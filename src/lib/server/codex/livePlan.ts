/**
 * Executes live plan generation through the Codex SDK using structured output.
 */
import { Codex } from "@openai/codex-sdk";
import type { Issue } from "@/lib/types";
import { buildPrompt } from "./prompt";
import { planOutputSchema, parseStructuredPlan } from "./schema";
import { CodexAuthenticationError, getErrorMessage, isLikelyAuthError } from "./errors";
import { resolveRuntimeConfig } from "./runtimeConfig";

const DEFAULT_PLAN_MAX_TIMEOUT_MS = 300000;

type TimeoutKind = "none" | "idle" | "max";
type TimeoutState = {
  kind: TimeoutKind;
};

// Parses positive timeout settings with a stable default.
function readPositiveTimeout(name: string): number | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Resolves optional progress timeout.
function resolvePlanIdleTimeoutMs(): number | null {
  return readPositiveTimeout("CODEX_PLAN_IDLE_TIMEOUT_MS");
}

// Resolves an absolute timeout cap that prevents infinite requests.
function resolvePlanMaxTimeoutMs(idleTimeoutMs: number | null): number {
  const configuredMax = readPositiveTimeout("CODEX_PLAN_MAX_TIMEOUT_MS") ?? DEFAULT_PLAN_MAX_TIMEOUT_MS;
  return Math.max(configuredMax, idleTimeoutMs ?? 0);
}

// Runs a live model turn and validates the structured plan response.
export async function generateLiveCodexPlan(issue: Issue, mergedContext: string) {
  const idleTimeoutMs = resolvePlanIdleTimeoutMs();
  const maxTimeoutMs = resolvePlanMaxTimeoutMs(idleTimeoutMs);
  const abortController = new AbortController();
  const timeoutState: TimeoutState = {
    kind: "none"
  };
  let idleTimeoutHandle: NodeJS.Timeout | null = null;

  const resetIdleTimeout = () => {
    if (!idleTimeoutMs) {
      return;
    }
    if (idleTimeoutHandle) {
      clearTimeout(idleTimeoutHandle);
    }
    idleTimeoutHandle = setTimeout(() => {
      timeoutState.kind = "idle";
      abortController.abort();
    }, idleTimeoutMs);
  };

  const maxTimeoutHandle = setTimeout(() => {
    timeoutState.kind = "max";
    abortController.abort();
  }, maxTimeoutMs);

  try {
    const runtime = resolveRuntimeConfig();
    const codex = new Codex(runtime.codexOptions);
    const thread = codex.startThread(runtime.threadOptions);
    const { events } = await thread.runStreamed(buildPrompt(issue, mergedContext), {
      outputSchema: planOutputSchema,
      signal: abortController.signal
    });

    let finalResponse = "";
    let turnFailedMessage = "";

    resetIdleTimeout();
    for await (const event of events) {
      resetIdleTimeout();
      if (event.type === "item.completed" && event.item.type === "agent_message") {
        finalResponse = event.item.text;
        continue;
      }
      if (event.type === "turn.failed") {
        turnFailedMessage = event.error.message;
        break;
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    if (turnFailedMessage) {
      throw new Error(turnFailedMessage);
    }

    const trimmedResponse = finalResponse.trim();
    if (!trimmedResponse) {
      throw new Error("Codex returned an empty response.");
    }
    return {
      plan: parseStructuredPlan(trimmedResponse),
      model: runtime.model
    };
  } catch (error) {
    if (timeoutState.kind === "idle") {
      const timeoutValue = idleTimeoutMs ?? 0;
      throw new Error(`Codex plan generation timed out after ${timeoutValue}ms without progress.`);
    }
    if (timeoutState.kind === "max") {
      throw new Error(`Codex plan generation exceeded ${maxTimeoutMs}ms.`);
    }

    const message = getErrorMessage(error, "Unknown Codex SDK error");
    if (isLikelyAuthError(message)) {
      throw new CodexAuthenticationError(message);
    }
    throw new Error(`Codex plan generation failed: ${message}`);
  } finally {
    clearTimeout(maxTimeoutHandle);
    if (idleTimeoutHandle) {
      clearTimeout(idleTimeoutHandle);
    }
  }
}
