import type { CodexPlan, Issue } from "@/lib/types";

function commandScope(issue: Issue): string {
  return issue.namespace ? `-n ${issue.namespace}` : "";
}

function genericPlan(issue: Issue): CodexPlan {
  const scope = commandScope(issue);
  return {
    quickFix: {
      summary: "Collect targeted diagnostics, verify the failure condition, and apply the minimum safe fix.",
      assumptions: [
        "The issue is reproducible and visible in current cluster events.",
        "The operator has kubectl access to read and update the affected workload."
      ],
      steps: [
        {
          stepId: "step-1",
          description: "Inspect recent events and current object state.",
          kubectl: `kubectl describe ${issue.kind.toLowerCase()} ${issue.name} ${scope}`.trim(),
          validation: "Events identify a specific failure reason tied to this resource.",
          rollback: null,
          impact: "none"
        },
        {
          stepId: "step-2",
          description: "Review logs for the primary failing container.",
          kubectl: `kubectl logs ${issue.name} ${scope} --all-containers --tail=200`.trim(),
          validation: "Logs confirm the same error reported in events.",
          rollback: null,
          impact: "none"
        },
        {
          stepId: "step-3",
          description: "Apply the narrowest corrective change and monitor rollout status.",
          kubectl: issue.namespace
            ? `kubectl rollout status deployment/${issue.name} -n ${issue.namespace} --timeout=120s`
            : null,
          validation: "The workload becomes healthy and no new warning events are emitted.",
          rollback: "Revert to the last known-good manifest revision.",
          impact: "low"
        }
      ],
      fallback: "Escalate with captured events, logs, and object definition for platform-team review."
    },
    rootCauseHypotheses: [
      "Recent config or image changes introduced an invalid runtime state.",
      "Cluster constraints (quota, scheduling, networking, or RBAC) block normal reconciliation."
    ],
    evidenceToGather: [
      "Object events over the last 30 minutes",
      "Container logs from current and previous restarts",
      "Diff between current manifest and last known-good deployment"
    ],
    recommendations: [
      "Add pre-deploy validation checks for image references and required config values.",
      "Introduce rollout canaries with automatic rollback on failed health checks.",
      "Track recurring failure reasons and create runbooks for top incident classes."
    ]
  };
}

export function generateLocalPlan(issue: Issue, userContext: string): CodexPlan {
  const fingerprint = `${issue.title} ${issue.context?.errorText || ""} ${userContext}`.toLowerCase();
  const scope = commandScope(issue);

  if (fingerprint.includes("imagepullbackoff") || fingerprint.includes("invalidimagename")) {
    return {
      quickFix: {
        summary: "Image pull is failing; validate image reference and registry access.",
        assumptions: [
          "The referenced tag or digest may not exist.",
          "Image pull credentials may be missing or invalid."
        ],
        steps: [
          {
            stepId: "step-1",
            description: "Inspect pod events for exact pull failure details.",
            kubectl: `kubectl describe pod ${issue.name} ${scope}`.trim(),
            validation: "Events show a specific image/tag or authentication error.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-2",
            description: "Confirm the image exists and the pull secret is attached.",
            kubectl: issue.namespace
              ? `kubectl get serviceaccount default -n ${issue.namespace} -o yaml`
              : null,
            validation: "The expected imagePullSecret is present and referenced.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-3",
            description: "Patch workload to a known-good image tag and restart rollout.",
            kubectl: issue.namespace
              ? `kubectl rollout restart deployment/${issue.name} -n ${issue.namespace}`
              : null,
            validation: "New pods transition to Running and ImagePullBackOff disappears.",
            rollback: "Restore the previous deployment spec if startup regressions appear.",
            impact: "medium"
          }
        ],
        fallback: "Pin to the last known-good image digest while fixing CI publish/auth configuration."
      },
      rootCauseHypotheses: [
        "Container registry path or tag was mistyped during deployment.",
        "Registry token expired or pull secret is not mounted to the active service account."
      ],
      evidenceToGather: [
        "Registry artifact listing for requested image tag",
        "ServiceAccount and PodSpec imagePullSecrets",
        "Recent deployment change set"
      ],
      recommendations: [
        "Add image existence checks in CI before rollout.",
        "Use immutable image digests for production workloads.",
        "Add automated alerts for repeated image pull failures."
      ]
    };
  }

  if (fingerprint.includes("crashloopbackoff")) {
    return {
      quickFix: {
        summary: "Container is crash-looping; isolate startup failure and revert risky changes.",
        assumptions: [
          "The application process exits quickly due to config or dependency errors.",
          "A recent deployment likely introduced the regression."
        ],
        steps: [
          {
            stepId: "step-1",
            description: "Collect previous container logs for exit reason.",
            kubectl: `kubectl logs ${issue.name} ${scope} --previous --all-containers --tail=200`.trim(),
            validation: "Previous logs show a deterministic startup failure.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-2",
            description: "Inspect config and environment references used by the workload.",
            kubectl: issue.namespace
              ? `kubectl get deployment ${issue.name} -n ${issue.namespace} -o yaml`
              : null,
            validation: "Config mismatches or missing refs are identified.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-3",
            description: "Rollback to last healthy revision and confirm stability.",
            kubectl: issue.namespace
              ? `kubectl rollout undo deployment/${issue.name} -n ${issue.namespace}`
              : null,
            validation: "Pod restarts flatten and readiness stays healthy.",
            rollback: "Re-apply the latest revision after fixing startup regressions.",
            impact: "medium"
          }
        ],
        fallback: "Run the container image locally with identical env vars to isolate startup behavior."
      },
      rootCauseHypotheses: [
        "Invalid environment configuration causes process startup failure.",
        "Dependency endpoints, credentials, or feature flags changed unexpectedly."
      ],
      evidenceToGather: [
        "Previous container logs",
        "Deployment revision history",
        "Diff of ConfigMap/Secret references"
      ],
      recommendations: [
        "Add startup probes that surface actionable error output quickly.",
        "Shift-left config validation and schema checks in CI.",
        "Gate rollout progression on error-rate SLOs."
      ]
    };
  }

  if (fingerprint.includes("oomkilled")) {
    return {
      quickFix: {
        summary: "Workload was OOM-killed; validate memory pressure and tune requests/limits.",
        assumptions: [
          "Current memory limits are below realistic peak usage.",
          "The workload may leak memory or burst under load."
        ],
        steps: [
          {
            stepId: "step-1",
            description: "Confirm OOM kills from pod status and events.",
            kubectl: `kubectl describe pod ${issue.name} ${scope}`.trim(),
            validation: "Last termination reason reports OOMKilled.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-2",
            description: "Measure current memory usage and compare to limits.",
            kubectl: issue.namespace ? `kubectl top pod ${issue.name} -n ${issue.namespace}` : null,
            validation: "Observed usage aligns with kill thresholds.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-3",
            description: "Increase memory limits conservatively and redeploy.",
            kubectl: issue.namespace
              ? `kubectl rollout restart deployment/${issue.name} -n ${issue.namespace}`
              : null,
            validation: "No additional OOM events during peak load window.",
            rollback: "Revert resource requests/limits to previous values.",
            impact: "low"
          }
        ],
        fallback: "Scale horizontally while performing memory profiling to remove leak patterns."
      },
      rootCauseHypotheses: [
        "Memory limits are undersized for real traffic patterns.",
        "Application memory leak increases RSS over runtime."
      ],
      evidenceToGather: [
        "Container memory usage over time",
        "Pod termination reason history",
        "Recent traffic or batch workload spikes"
      ],
      recommendations: [
        "Define right-sized requests/limits from production telemetry.",
        "Automate leak detection in load testing.",
        "Adopt HPA/VPA strategy for memory-sensitive workloads."
      ]
    };
  }

  if (fingerprint.includes("pending") || fingerprint.includes("failedscheduling")) {
    return {
      quickFix: {
        summary: "Pod is pending due to scheduling constraints; validate capacity and placement rules.",
        assumptions: [
          "Node selectors, taints, or resource requests exceed available capacity.",
          "Cluster autoscaling is absent or constrained."
        ],
        steps: [
          {
            stepId: "step-1",
            description: "Inspect scheduling events for blocker details.",
            kubectl: `kubectl describe pod ${issue.name} ${scope}`.trim(),
            validation: "Scheduler events list exact unmet constraints.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-2",
            description: "Review node allocatable capacity and taints.",
            kubectl: "kubectl get nodes -o wide",
            validation: "Capacity/taint mismatch is visible against pod requirements.",
            rollback: null,
            impact: "none"
          },
          {
            stepId: "step-3",
            description: "Adjust placement or requests to fit available nodes.",
            kubectl: issue.namespace
              ? `kubectl get pod ${issue.name} -n ${issue.namespace} -o yaml`
              : null,
            validation: "Pod is scheduled and transitions beyond Pending.",
            rollback: "Revert affinity/toleration/resource changes if workload placement regresses.",
            impact: "low"
          }
        ],
        fallback: "Provision compatible node pools for specialized workloads (GPU/high-memory)."
      },
      rootCauseHypotheses: [
        "Resource requests exceed current cluster capacity.",
        "Affinity or toleration rules conflict with available nodes."
      ],
      evidenceToGather: [
        "Pod scheduling event history",
        "Node taints, labels, and allocatable resources",
        "Workload affinity/toleration/request settings"
      ],
      recommendations: [
        "Add admission checks for unschedulable workload specs.",
        "Monitor pending pod duration as an SLO.",
        "Create dedicated node pools for specialized hardware requests."
      ]
    };
  }

  return genericPlan(issue);
}
