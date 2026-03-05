/**
 * Executes live plan generation through the Codex SDK using structured output.
 */
import { Codex } from "@openai/codex-sdk";
import type { Issue } from "@/lib/types";
import { buildPrompt } from "./prompt";
import { planOutputSchema, parseStructuredPlan } from "./schema";
import { CodexAuthenticationError, getErrorMessage, isLikelyAuthError } from "./errors";
import { resolveRuntimeConfig } from "./runtimeConfig";

const DEFAULT_PLAN_TIMEOUT_MS = 90000;

// Parses positive timeout settings with a stable default.
function resolvePlanTimeoutMs(): number {
  const raw = process.env.CODEX_PLAN_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_PLAN_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PLAN_TIMEOUT_MS;
}

// Runs a live model turn and validates the structured plan response.
export async function generateLiveCodexPlan(issue: Issue, mergedContext: string) {
  const timeoutMs = resolvePlanTimeoutMs();
  const abortController = new AbortController();
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, timeoutMs);

  try {
    const runtime = resolveRuntimeConfig();
    const codex = new Codex(runtime.codexOptions);
    const thread = codex.startThread(runtime.threadOptions);

    const turn = await thread.run(buildPrompt(issue, mergedContext), {
      outputSchema: planOutputSchema,
      signal: abortController.signal
    });
    const finalResponse = turn.finalResponse?.trim();

    if (!finalResponse) {
      throw new Error("Codex returned an empty response.");
    }

    return {
      plan: parseStructuredPlan(finalResponse),
      model: runtime.model
    };
  } catch (error) {
    if (timedOut) {
      throw new Error(`Codex plan generation timed out after ${timeoutMs}ms.`);
    }

    const message = getErrorMessage(error, "Unknown Codex SDK error");
    if (isLikelyAuthError(message)) {
      throw new CodexAuthenticationError(message);
    }
    throw new Error(`Codex plan generation failed: ${message}`);
  } finally {
    clearTimeout(timeoutHandle);
  }
}
