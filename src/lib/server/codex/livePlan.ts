/**
 * Executes live plan generation through the Codex SDK using structured output.
 */
import { Codex } from "@openai/codex-sdk";
import type { Issue } from "@/lib/types";
import { buildPrompt } from "./prompt";
import { planOutputSchema, parseStructuredPlan } from "./schema";
import { CodexAuthenticationError, getErrorMessage, isLikelyAuthError } from "./errors";
import { resolveRuntimeConfig } from "./runtimeConfig";

// Runs a live model turn and validates the structured plan response.
export async function generateLiveCodexPlan(issue: Issue, mergedContext: string) {
  try {
    const runtime = resolveRuntimeConfig();
    const codex = new Codex(runtime.codexOptions);
    const thread = codex.startThread(runtime.threadOptions);

    const turn = await thread.run(buildPrompt(issue, mergedContext), {
      outputSchema: planOutputSchema
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
    const message = getErrorMessage(error, "Unknown Codex SDK error");
    if (isLikelyAuthError(message)) {
      throw new CodexAuthenticationError(message);
    }
    throw new Error(`Codex plan generation failed: ${message}`);
  }
}
