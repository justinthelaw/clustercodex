export type CodexPlanIssue = {
  id: string;
  title: string;
  severity: string;
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

export type CodexPlan = {
  quickFix: {
    summary: string;
    assumptions: string[];
    steps: Array<{
      stepId: string;
      description: string;
      kubectl: string | null;
      validation: string;
      rollback: string | null;
      impact: "none" | "low" | "medium" | "high";
    }>;
    fallback: string;
  };
  rootCauseHypotheses: string[];
  evidenceToGather: string[];
  recommendations: string[];
};
