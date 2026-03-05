/**
 * Computes server-side Codex authentication readiness for plan-generation workflows.
 */
import { Codex } from "@openai/codex-sdk";
import type { CodexAuthStatus } from "@/lib/types";
import { getErrorMessage } from "./errors";
import { resolveRuntimeConfig, type ResolvedCodexRuntime } from "./runtimeConfig";

type RuntimeAvailability = {
  available: boolean;
  details: string;
};

// Verifies that the Codex runtime can be initialized with the active config.
function checkCodexRuntimeAvailability(runtime: ResolvedCodexRuntime): RuntimeAvailability {
  try {
    const codex = new Codex(runtime.codexOptions);
    codex.startThread(runtime.threadOptions);
    return {
      available: true,
      details: "Codex runtime is available."
    };
  } catch (error) {
    return {
      available: false,
      details: getErrorMessage(error, "Codex runtime is not available.")
    };
  }
}

// Returns auth status details used by APIs and status indicators.
export async function getCodexAuthStatus(): Promise<CodexAuthStatus> {
  let runtime: ResolvedCodexRuntime;
  try {
    runtime = resolveRuntimeConfig();
  } catch (error) {
    return {
      authenticated: false,
      method: "auto",
      provider: "configuration-error",
      details: getErrorMessage(error, "Invalid Codex runtime configuration.")
    };
  }

  if (runtime.authMethod === "local_provider") {
    return {
      authenticated: true,
      method: "local_provider",
      provider: runtime.providerSummary,
      details: `Using local provider ${runtime.providerSummary}.`
    };
  }

  if (runtime.authMethod === "api_key") {
    return {
      authenticated: runtime.apiKeyConfigured,
      method: "api_key",
      provider: runtime.providerSummary,
      details: runtime.apiKeyConfigured
        ? "API key auth mode is configured."
        : "API key auth mode is selected, but CODEX_API_KEY/OPENAI_API_KEY is not set."
    };
  }

  if (runtime.authMethod === "auto" && runtime.apiKeyConfigured) {
    return {
      authenticated: true,
      method: "auto",
      provider: runtime.providerSummary,
      details: "Auto auth mode is active and an API key is available."
    };
  }

  const availability = checkCodexRuntimeAvailability(runtime);
  if (!availability.available) {
    return {
      authenticated: false,
      method: runtime.authMethod,
      provider: runtime.providerSummary,
      details: availability.details
    };
  }

  return {
    authenticated: true,
    method: runtime.authMethod,
    provider: runtime.providerSummary,
    details:
      runtime.authMethod === "auto"
        ? "Auto auth mode is configured. OAuth is validated during plan generation."
        : "ChatGPT OAuth mode is configured. Authentication is validated during plan generation."
  };
}
