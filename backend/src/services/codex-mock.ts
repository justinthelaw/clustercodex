import type { CodexPlanIssue, CodexPlan } from "./codex-types.js";

const quickFixByTitle: Record<string, CodexPlan["quickFix"]> = {
  crashloopbackoff: {
    summary: "Pod is crash-looping; check config and recent changes.",
    assumptions: ["Recent config or image changes may be causing the crash."],
    steps: [
      {
        stepId: "step-1",
        description: "Inspect previous container logs for the crash reason.",
        kubectl: "kubectl logs <pod> -n <namespace> --previous",
        validation: "Log output shows the error leading to the crash.",
        rollback: null,
        impact: "none"
      },
      {
        stepId: "step-2",
        description: "Compare current config with the last known-good version.",
        kubectl: "kubectl get configmap <name> -n <namespace> -o yaml",
        validation: "Diff highlights recent changes tied to the failure.",
        rollback: null,
        impact: "none"
      }
    ],
    fallback: "Rollback to the last known-good config or image."
  },
  imagepullbackoff: {
    summary: "Image pull failed; validate image name and registry access.",
    assumptions: ["Image tag or registry credentials may be incorrect."],
    steps: [
      {
        stepId: "step-1",
        description: "Verify the image tag exists in the registry.",
        kubectl: "kubectl describe pod <pod> -n <namespace>",
        validation: "Events show the exact image and pull error.",
        rollback: null,
        impact: "none"
      },
      {
        stepId: "step-2",
        description: "Check imagePullSecrets or registry access settings.",
        kubectl: "kubectl get secret <secret> -n <namespace>",
        validation: "Secret is present and referenced by the workload.",
        rollback: null,
        impact: "none"
      }
    ],
    fallback: "Pin to a known-good image tag."
  },
  oomkilled: {
    summary: "Pod was OOMKilled; validate memory usage and limits.",
    assumptions: ["Workload may exceed configured memory limits."],
    steps: [
      {
        stepId: "step-1",
        description: "Inspect memory usage to confirm OOM conditions.",
        kubectl: "kubectl top pod <pod> -n <namespace>",
        validation: "Observed memory usage spikes near the limit.",
        rollback: null,
        impact: "none"
      },
      {
        stepId: "step-2",
        description: "Review requests/limits for the workload.",
        kubectl: "kubectl get deploy <name> -n <namespace> -o yaml",
        validation: "Limits align with observed usage patterns.",
        rollback: null,
        impact: "low"
      }
    ],
    fallback: "Temporarily increase memory limits while investigating."
  }
};

const analysisByTitle: Record<
  string,
  Pick<CodexPlan, "rootCauseHypotheses" | "evidenceToGather" | "recommendations">
> = {
  crashloopbackoff: {
    rootCauseHypotheses: ["Invalid config introduced during deploy."],
    evidenceToGather: ["Compare config versions", "Review deployment history"],
    recommendations: ["Add config validation CI step", "Use canary deploys"]
  },
  imagepullbackoff: {
    rootCauseHypotheses: ["Missing image tag in registry"],
    evidenceToGather: ["CI logs for image build", "Registry audit logs"],
    recommendations: ["Add publish verification", "Introduce tag promotion gates"]
  },
  oomkilled: {
    rootCauseHypotheses: ["Memory leaks or undersized limits"],
    evidenceToGather: ["Heap profiles", "Historical memory metrics"],
    recommendations: ["Add autoscaling based on memory", "Profile hot paths"]
  }
};

export function getMockPlan(issue: CodexPlanIssue): CodexPlan {
  const key = issue.title.toLowerCase();
  const quickFix =
    quickFixByTitle[key] || {
      summary: "Investigate the issue with targeted checks.",
      assumptions: ["Recent changes may have introduced the problem."],
      steps: [
        {
          stepId: "step-1",
          description: "Inspect recent events and logs for the resource.",
          kubectl: "kubectl describe <kind>/<name> -n <namespace>",
          validation: "Events highlight the root error.",
          rollback: null,
          impact: "none"
        }
      ],
      fallback: "Escalate to the platform team with collected evidence."
    };

  const analysis =
    analysisByTitle[key] || {
      rootCauseHypotheses: ["Unknown configuration or runtime regression"],
      evidenceToGather: ["Deployment diffs", "Resource metrics"],
      recommendations: ["Add automated checks", "Improve alerting coverage"]
    };

  return {
    quickFix,
    rootCauseHypotheses: analysis.rootCauseHypotheses,
    evidenceToGather: analysis.evidenceToGather,
    recommendations: analysis.recommendations
  };
}
