/**
 * Defines shared domain types used by frontend components and server routes.
 */
export type Issue = {
  id: string;
  title: string;
  kind: string;
  namespace: string;
  name: string;
  detectedAt: string;
  context?: {
    kind: string;
    name: string;
    errorText: string;
    eventsTable?: string;
    definition?: string;
  };
};

export type PlanStep = {
  stepId: string;
  description: string;
  kubectl: string | null;
  validation: string;
  rollback: string | null;
  impact: "none" | "low" | "medium" | "high";
};

export type CodexPlan = {
  quickFix: {
    summary: string;
    assumptions: string[];
    steps: PlanStep[];
    fallback: string;
  };
  rootCauseHypotheses: string[];
  evidenceToGather: string[];
  recommendations: string[];
};

export type PlanProvider = "codex" | "local";

export type PlanGenerationResponse = {
  plan: CodexPlan;
  provider: PlanProvider;
  model: string;
  warning?: string;
};

export type CodexAuthMethod =
  | "chatgpt_oauth"
  | "api_key"
  | "auto"
  | "local_provider";

export type CodexAuthStatus = {
  authenticated: boolean;
  method: CodexAuthMethod;
  provider: string;
  details: string;
};

export type ResourceKind =
  | "Node"
  | "Deployment"
  | "DaemonSet"
  | "ReplicaSet"
  | "StatefulSet"
  | "Job"
  | "CronJob"
  | "Service"
  | "Ingress"
  | "Namespace"
  | "ConfigMap"
  | "Secret"
  | "ServiceAccount"
  | "PersistentVolume"
  | "PersistentVolumeClaim"
  | "CustomResourceDefinition"
  | "Pod"
  | "Event";

export type ResourceItem = Record<string, string | number | boolean | null | undefined>;
