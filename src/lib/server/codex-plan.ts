import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  Codex,
  type CodexOptions,
  type ThreadOptions
} from "@openai/codex-sdk";
import type {
  CodexAuthMethod,
  CodexAuthStatus,
  CodexPlan,
  Issue,
  PlanStep
} from "@/lib/types";

const DEFAULT_OAUTH_LOGIN_COMMAND = "npx codex login --device-auth";
const PLAN_IMPACT_VALUES: PlanStep["impact"][] = ["none", "low", "medium", "high"];
const execFileAsync = promisify(execFile);

const LOCAL_PROVIDER_ALIASES = new Set(["ollama", "lmstudio", "llama-server", "custom"]);
type CodexAuthMode = "chatgpt" | "api" | "auto";

type ResolvedCodexRuntime = {
  model: string;
  providerSummary: string;
  authMode: CodexAuthMode;
  authMethod: CodexAuthMethod;
  loginCommand?: string;
  apiKeyConfigured: boolean;
  codexOptions: CodexOptions;
  threadOptions: ThreadOptions;
};

const PLAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["quickFix", "rootCauseHypotheses", "evidenceToGather", "recommendations"],
  properties: {
    quickFix: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "assumptions", "steps", "fallback"],
      properties: {
        summary: { type: "string" },
        assumptions: {
          type: "array",
          items: { type: "string" }
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["stepId", "description", "kubectl", "validation", "rollback", "impact"],
            properties: {
              stepId: { type: "string" },
              description: { type: "string" },
              kubectl: {
                anyOf: [{ type: "string" }, { type: "null" }]
              },
              validation: { type: "string" },
              rollback: {
                anyOf: [{ type: "string" }, { type: "null" }]
              },
              impact: {
                type: "string",
                enum: PLAN_IMPACT_VALUES
              }
            }
          }
        },
        fallback: { type: "string" }
      }
    },
    rootCauseHypotheses: {
      type: "array",
      items: { type: "string" }
    },
    evidenceToGather: {
      type: "array",
      items: { type: "string" }
    },
    recommendations: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveCodexModel(): string {
  return requireEnv("CODEX_MODEL");
}

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

  if (!LOCAL_PROVIDER_ALIASES.has(normalized)) {
    throw new Error(
      "Invalid CODEX_LOCAL_PROVIDER. Supported values: none, ollama, lmstudio, llama-server, custom."
    );
  }

  return normalized;
}

function sanitizeProviderId(raw: string): string {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : "local";
}

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

function resolveRuntimeConfig(): ResolvedCodexRuntime {
  const model = resolveCodexModel();
  const authMode = resolveAuthMode();
  const localProvider = resolveLocalProvider();
  const apiKey = readEnv("CODEX_API_KEY") || readEnv("OPENAI_API_KEY");

  const codexOptions: CodexOptions = {};
  const configOverrides: NonNullable<CodexOptions["config"]> = {};
  const envOverrides: Record<string, string> = {};

  let authMethod: CodexAuthMethod;
  let loginCommand: string | undefined;
  let providerSummary = "openai";

  if (localProvider) {
    authMethod = "local_provider";

    const providerId = sanitizeProviderId(requireEnv("CODEX_LOCAL_PROVIDER_ID"));
    const providerName = requireEnv("CODEX_LOCAL_PROVIDER_NAME");
    const providerBaseUrl = requireEnv("CODEX_LOCAL_BASE_URL");
    const providerEnvKey = requireEnv("CODEX_LOCAL_ENV_KEY");
    const providerApiKey =
      readEnv("CODEX_LOCAL_API_KEY") || apiKey || readEnv(providerEnvKey);

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
      loginCommand = DEFAULT_OAUTH_LOGIN_COMMAND;
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
    loginCommand,
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

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildPrompt(issue: Issue, mergedContext: string): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPlanStep(value: unknown): value is PlanStep {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.stepId === "string" &&
    typeof value.description === "string" &&
    isNullableString(value.kubectl) &&
    typeof value.validation === "string" &&
    isNullableString(value.rollback) &&
    PLAN_IMPACT_VALUES.includes(value.impact as PlanStep["impact"])
  );
}

function isCodexPlan(value: unknown): value is CodexPlan {
  if (!isRecord(value) || !isRecord(value.quickFix)) {
    return false;
  }

  const quickFix = value.quickFix;
  return (
    typeof quickFix.summary === "string" &&
    isStringArray(quickFix.assumptions) &&
    Array.isArray(quickFix.steps) &&
    quickFix.steps.every((step) => isPlanStep(step)) &&
    typeof quickFix.fallback === "string" &&
    isStringArray(value.rootCauseHypotheses) &&
    isStringArray(value.evidenceToGather) &&
    isStringArray(value.recommendations)
  );
}

function parseStructuredPlan(rawText: string): CodexPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Codex returned non-JSON content.");
  }

  if (!isCodexPlan(parsed)) {
    throw new Error("Codex JSON failed schema validation.");
  }

  return parsed;
}

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not logged in") ||
    normalized.includes("auth") ||
    normalized.includes("unauthorized") ||
    normalized.includes("token") ||
    normalized.includes("codex login")
  );
}

function normalizeStatusOutput(stdout: string, stderr: string): string {
  return [stdout, stderr]
    .join("\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("warning:"))
    .join("\n")
    .trim();
}

function parseIsAuthenticated(output: string): boolean {
  const normalized = output.toLowerCase();
  return (
    normalized.includes("logged in") ||
    normalized.includes("authenticated") ||
    normalized.includes("using chatgpt")
  );
}

async function queryChatGptOAuthStatus() {
  try {
    const { stdout, stderr } = await execFileAsync("npx", ["codex", "login", "status"], {
      cwd: process.cwd(),
      env: process.env as NodeJS.ProcessEnv,
      timeout: 20_000
    });

    const details = normalizeStatusOutput(String(stdout), String(stderr));
    return {
      authenticated: parseIsAuthenticated(details),
      details
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check Codex auth status.";
    return {
      authenticated: false,
      details: normalizeStatusOutput("", message)
    };
  }
}

export class CodexAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexAuthenticationError";
  }
}

export async function getCodexAuthStatus(): Promise<CodexAuthStatus> {
  let runtime: ResolvedCodexRuntime;
  try {
    runtime = resolveRuntimeConfig();
  } catch (error) {
    const details = error instanceof Error ? error.message : "Invalid Codex runtime configuration.";
    return {
      authenticated: false,
      method: "auto",
      provider: "configuration-error",
      details
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

  if (runtime.authMethod === "auto") {
    if (runtime.apiKeyConfigured) {
      return {
        authenticated: true,
        method: "auto",
        provider: runtime.providerSummary,
        details: "Auto auth mode is active and an API key is available."
      };
    }

    const oauth = await queryChatGptOAuthStatus();
    return {
      authenticated: oauth.authenticated,
      method: "auto",
      provider: runtime.providerSummary,
      loginCommand: DEFAULT_OAUTH_LOGIN_COMMAND,
      details: oauth.authenticated
        ? "Auto auth mode is active and ChatGPT OAuth is connected."
        : [
            "Auto auth mode is active, but no API key was detected and ChatGPT OAuth is not connected.",
            `Run \`${DEFAULT_OAUTH_LOGIN_COMMAND}\` or set CODEX_API_KEY.`
          ].join(" ")
    };
  }

  const oauth = await queryChatGptOAuthStatus();
  return {
    authenticated: oauth.authenticated,
    method: "chatgpt_oauth",
    provider: runtime.providerSummary,
    loginCommand: runtime.loginCommand,
    details: oauth.details || (oauth.authenticated ? "Codex OAuth is connected." : "Codex OAuth not detected.")
  };
}

export async function generateLiveCodexPlan(issue: Issue, mergedContext: string) {
  const runtime = resolveRuntimeConfig();
  const codex = new Codex(runtime.codexOptions);
  const thread = codex.startThread(runtime.threadOptions);

  try {
    const turn = await thread.run(buildPrompt(issue, mergedContext), {
      outputSchema: PLAN_OUTPUT_SCHEMA
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
    const message = error instanceof Error ? error.message : "Unknown Codex SDK error";
    if (isAuthErrorMessage(message)) {
      throw new CodexAuthenticationError(message);
    }
    throw new Error(`Codex plan generation failed: ${message}`);
  }
}
