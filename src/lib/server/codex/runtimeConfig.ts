/**
 * Resolves Codex runtime configuration from environment variables for server usage.
 */
import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import type { CodexAuthMethod } from "@/lib/types";

const localProviderAliases = new Set(["ollama", "lmstudio", "llama-server", "custom"]);

type CodexAuthMode = "chatgpt" | "api" | "auto";

export type ResolvedCodexRuntime = {
  model: string;
  providerSummary: string;
  authMode: CodexAuthMode;
  authMethod: CodexAuthMethod;
  apiKeyConfigured: boolean;
  codexOptions: CodexOptions;
  threadOptions: ThreadOptions;
};

// Returns a trimmed environment variable value when present.
function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Enforces required runtime environment variables.
function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Normalizes configured auth mode to a supported internal variant.
function resolveAuthMode(): CodexAuthMode {
  const raw = requireEnv("CODEX_AUTH_MODE").toLowerCase();
  if (raw === "api" || raw === "api-key" || raw === "apikey") {
    return "api";
  }
  if (raw === "auto") {
    return "auto";
  }
  if (raw === "chatgpt") {
    return "chatgpt";
  }
  throw new Error("Invalid CODEX_AUTH_MODE. Supported values: chatgpt, api, auto.");
}

// Normalizes optional local provider configuration and aliases.
function resolveLocalProvider(): string | null {
  const raw = requireEnv("CODEX_LOCAL_PROVIDER");
  const normalized = raw.toLowerCase().replace(/[_.]/g, "-");

  if (normalized === "none" || normalized === "off") {
    return null;
  }
  if (normalized === "lm-studio") {
    return "lmstudio";
  }
  if (normalized === "llamaserver" || normalized === "llama-cpp" || normalized === "llama.cpp") {
    return "llama-server";
  }
  if (!localProviderAliases.has(normalized)) {
    throw new Error(
      "Invalid CODEX_LOCAL_PROVIDER. Supported values: none, ollama, lmstudio, llama-server, custom."
    );
  }

  return normalized;
}

// Converts provider identifiers to safe config keys.
function sanitizeProviderId(raw: string): string {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : "local";
}

// Merges the process environment with explicit overrides for child runtime execution.
function buildInheritedEnv(extra: Record<string, string>): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      inherited[key] = value;
    }
  }
  return {
    ...inherited,
    ...extra
  };
}

// Builds the final runtime options consumed by Codex SDK initialization.
export function resolveRuntimeConfig(): ResolvedCodexRuntime {
  const model = requireEnv("CODEX_MODEL");
  const authMode = resolveAuthMode();
  const localProvider = resolveLocalProvider();
  const apiKey = readEnv("CODEX_API_KEY") || readEnv("OPENAI_API_KEY");

  const codexOptions: CodexOptions = {};
  const configOverrides: NonNullable<CodexOptions["config"]> = {};
  const envOverrides: Record<string, string> = {};

  let authMethod: CodexAuthMethod;
  let providerSummary = "openai";

  if (localProvider) {
    authMethod = "local_provider";

    const providerId = sanitizeProviderId(requireEnv("CODEX_LOCAL_PROVIDER_ID"));
    const providerName = requireEnv("CODEX_LOCAL_PROVIDER_NAME");
    const providerBaseUrl = requireEnv("CODEX_LOCAL_BASE_URL");
    const providerEnvKey = requireEnv("CODEX_LOCAL_ENV_KEY");
    const providerApiKey = readEnv("CODEX_LOCAL_API_KEY") || apiKey || readEnv(providerEnvKey);

    configOverrides.model_provider = providerId;
    configOverrides.model_providers = {
      [providerId]: {
        name: providerName,
        base_url: providerBaseUrl,
        env_key: providerEnvKey
      }
    };

    if (providerApiKey) {
      envOverrides[providerEnvKey] = providerApiKey;
    }

    providerSummary = `${providerId} (${providerBaseUrl})`;
  } else {
    if (authMode === "api") {
      authMethod = "api_key";
    } else if (authMode === "auto") {
      authMethod = "auto";
    } else {
      authMethod = "chatgpt_oauth";
    }

    const baseUrl = readEnv("CODEX_BASE_URL");
    if (baseUrl) {
      codexOptions.baseUrl = baseUrl;
      providerSummary = `openai-compatible (${baseUrl})`;
    }
  }

  if (!localProvider && authMode === "chatgpt") {
    configOverrides.forced_login_method = "chatgpt";
  } else if (!localProvider && authMode === "api") {
    configOverrides.forced_login_method = "api";
  }

  if (Object.keys(configOverrides).length > 0) {
    codexOptions.config = configOverrides;
  }
  if (Object.keys(envOverrides).length > 0) {
    codexOptions.env = buildInheritedEnv(envOverrides);
  }
  if (authMethod === "api_key" && apiKey) {
    codexOptions.apiKey = apiKey;
  }

  return {
    model,
    providerSummary,
    authMode,
    authMethod,
    apiKeyConfigured: Boolean(apiKey),
    codexOptions,
    threadOptions: {
      model,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      workingDirectory: process.cwd(),
      networkAccessEnabled: false,
      webSearchMode: "disabled"
    }
  };
}
