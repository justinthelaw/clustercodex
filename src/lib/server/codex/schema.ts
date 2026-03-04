/**
 * Defines the expected plan schema and runtime validation for model responses.
 */
import type { CodexPlan, PlanStep } from "@/lib/types";

const planImpactValues: PlanStep["impact"][] = ["none", "low", "medium", "high"];

export const planOutputSchema = {
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
                enum: planImpactValues
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

// Guards object-shape checks for schema validation helpers.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Verifies array values are comprised only of strings.
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Verifies nullable string fields in generated step payloads.
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// Validates individual remediation step objects.
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
    planImpactValues.includes(value.impact as PlanStep["impact"])
  );
}

// Validates the complete plan payload shape.
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

// Parses and validates structured plan responses from model output.
export function parseStructuredPlan(rawText: string): CodexPlan {
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
