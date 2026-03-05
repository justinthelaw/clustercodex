/**
 * Centralizes Codex-specific error typing and message classification helpers.
 */
const missingCodexCliBinariesFragment = "Unable to locate Codex CLI binaries";

/** Represents authentication failures that routes can map to 401 responses. */
export class CodexAuthenticationError extends Error {
  /** Initializes a typed authentication error with a stable class name. */
  constructor(message: string) {
    super(message);
    this.name = "CodexAuthenticationError";
  }
}

/** Extracts a stable message from unknown error values. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

/** Identifies messages that likely represent auth or token-related failures. */
export function isLikelyAuthError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not logged in") ||
    normalized.includes("auth") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("token") ||
    normalized.includes("401")
  );
}

/** Identifies SDK failures caused by missing local Codex CLI optional binaries. */
export function isMissingCodexCliBinariesError(message: string): boolean {
  return message.includes(missingCodexCliBinariesFragment);
}
