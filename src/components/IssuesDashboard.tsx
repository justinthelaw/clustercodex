"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { loadDismissedIssueIds, saveDismissedIssueIds } from "@/lib/dismissed-issues";
import { listIssues } from "@/lib/k8s-client";
import { generateLocalPlan } from "@/lib/plan-generator";
import type { CodexPlan, Issue } from "@/lib/types";

export default function IssuesDashboard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dismissedIssues, setDismissedIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planResult, setPlanResult] = useState<CodexPlan | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState("");
  const [view, setView] = useState<"active" | "dismissed">("active");
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [copyPressed, setCopyPressed] = useState(false);
  const [planHasScroll, setPlanHasScroll] = useState(false);
  const planOutputRef = useRef<HTMLTextAreaElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const allIssues = await listIssues();
      const dismissedIds = loadDismissedIssueIds();

      setIssues(allIssues.filter((issue) => !dismissedIds.has(issue.id)));
      setDismissedIssues(allIssues.filter((issue) => dismissedIds.has(issue.id)));
    } catch (loadError) {
      setError(
        "Failed to load cluster issues. Verify your kubeconfig and cluster permissions are valid."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const closeModal = () => {
    setSelectedIssue(null);
    setPlanOpen(false);
    setUserContext("");
    setContextSnapshot("");
    setPlanLoading(false);
    setPlanError("");
    setPlanResult(null);
  };

  const handleDismiss = (issueId: string) => {
    setIssues((previous) => {
      const issue = previous.find((item) => item.id === issueId);
      if (!issue) {
        return previous;
      }

      setDismissedIssues((dismissedPrevious) => {
        if (dismissedPrevious.some((item) => item.id === issue.id)) {
          return dismissedPrevious;
        }
        return [issue, ...dismissedPrevious];
      });

      const dismissedIds = loadDismissedIssueIds();
      dismissedIds.add(issue.id);
      saveDismissedIssueIds(dismissedIds);

      return previous.filter((item) => item.id !== issueId);
    });
  };

  const handleRestore = (issueId: string) => {
    setDismissedIssues((previous) => {
      const issue = previous.find((item) => item.id === issueId);
      if (!issue) {
        return previous;
      }

      setIssues((activePrevious) => {
        if (activePrevious.some((item) => item.id === issue.id)) {
          return activePrevious;
        }
        return [issue, ...activePrevious];
      });

      const dismissedIds = loadDismissedIssueIds();
      dismissedIds.delete(issue.id);
      saveDismissedIssueIds(dismissedIds);

      return previous.filter((item) => item.id !== issueId);
    });
  };

  const openModal = (issue: Issue) => {
    setSelectedIssue(issue);
    setPlanOpen(true);
    setPlanResult(null);
    setPlanError("");

    if (issue.context) {
      const { kind, name, errorText, eventsTable, definition } = issue.context;
      const trimmedDefinition = definition?.trimEnd() || "";
      const definitionBlock =
        trimmedDefinition && trimmedDefinition !== "No definition found."
          ? trimmedDefinition
              .split("\n")
              .map((line) => `  ${line}`)
              .join("\n")
          : trimmedDefinition || "No definition found.";
      const blocks = [
        `Kind: ${kind}`,
        `Name: ${name}`,
        `Error: ${errorText || "N/A"}`,
        "Events:",
        eventsTable || "No events found.",
        "Definition:",
        definitionBlock
      ];
      setContextSnapshot(blocks.join("\n"));
      return;
    }

    setContextSnapshot("");
  };

  const submitPlan = async () => {
    if (!selectedIssue) {
      return;
    }

    setPlanLoading(true);
    setPlanError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const mergedContext = [contextSnapshot.trim(), userContext.trim()].filter(Boolean).join("\n\n");
      const result = generateLocalPlan(selectedIssue, mergedContext);
      setPlanResult(result);
    } catch {
      setPlanError("Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const planText = useMemo(() => {
    if (!planResult) {
      return "";
    }

    const quickFix = planResult.quickFix;
    const lines = [`Summary: ${quickFix.summary || ""}\n`, "Steps:"];

    quickFix.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.description || ""}`);
      if (step.kubectl) {
        lines.push(`   kubectl: ${step.kubectl}`);
      }
      if (step.validation) {
        lines.push(`   Validation: ${step.validation}`);
      }
      if (step.rollback) {
        lines.push(`   Rollback: ${step.rollback}`);
      }
      if (step.impact) {
        lines.push(`   Impact: ${step.impact}`);
      }
    });

    lines.push("");
    lines.push(`Fallback: ${quickFix.fallback || ""}`);
    lines.push("");
    lines.push("Root Cause Hypotheses:");
    planResult.rootCauseHypotheses.forEach((item) => lines.push(`- ${item}`));
    lines.push("Evidence to Gather:");
    planResult.evidenceToGather.forEach((item) => lines.push(`- ${item}`));
    lines.push("Recommendations:");
    planResult.recommendations.forEach((item) => lines.push(`- ${item}`));

    return lines.join("\n");
  }, [planResult]);

  useEffect(() => {
    const node = planOutputRef.current;
    if (!node) {
      setPlanHasScroll(false);
      return;
    }

    setPlanHasScroll(node.scrollHeight > node.clientHeight + 1);
  }, [planText]);

  const handleCopyPlan = async () => {
    if (!planText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(planText);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    } finally {
      setCopyPressed(false);
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>Detected Issues</h2>
        <button className="button secondary" onClick={() => void loadData()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <ErrorBanner message={error} />

      <div className="button-row">
        <button className={`button ${view === "active" ? "" : "secondary"}`} onClick={() => setView("active")}>
          Active
        </button>
        <button
          className={`button ${view === "dismissed" ? "" : "secondary"}`}
          onClick={() => setView("dismissed")}
        >
          Dismissed
        </button>
      </div>

      {loading ? (
        <div>Loading issues...</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Namespace</th>
                <th>Name</th>
                <th>Severity</th>
                <th>Detected</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(view === "active" ? issues : dismissedIssues).length === 0 ? (
                <tr>
                  <td colSpan={6}>{view === "active" ? "No issues detected." : "No dismissed issues."}</td>
                </tr>
              ) : (
                (view === "active" ? issues : dismissedIssues).map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.kind}</td>
                    <td>{issue.namespace}</td>
                    <td>{issue.name}</td>
                    <td>
                      <span className="status-chip">{issue.severity || "unknown"}</span>
                    </td>
                    <td>{new Date(issue.detectedAt).toLocaleString()}</td>
                    <td>
                      <div className="table-actions">
                        {view === "active" ? (
                          <>
                            <button className="button tertiary" onClick={() => openModal(issue)}>
                              Cluster Codex
                            </button>
                            <button className="button danger" onClick={() => handleDismiss(issue.id)}>
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <button className="button secondary" onClick={() => handleRestore(issue.id)}>
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedIssue && planOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="card modal-card">
            <div className="modal-header-row">
              <h2>Cluster Codex</h2>
              <button className="button secondary" onClick={closeModal} aria-label="Close">
                Close
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="context">Cluster Issue Context</label>
                <textarea
                  id="context"
                  value={contextSnapshot}
                  onChange={(event) => setContextSnapshot(event.target.value)}
                  className="text-block text-block-large"
                />
                <div className="status-inline">
                  Edit captured context before generating a remediation plan.
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="userContext">Additional User Context</label>
                <textarea
                  id="userContext"
                  value={userContext}
                  onChange={(event) => setUserContext(event.target.value)}
                  className="text-block text-block-small"
                />
              </div>

              {planError && <ErrorBanner message={planError} />}

              {!planText && (
                <div className="button-row">
                  <button className="button" onClick={() => void submitPlan()} disabled={planLoading}>
                    {planLoading ? "Generating..." : "Generate Plan"}
                  </button>
                </div>
              )}

              {planText && (
                <div>
                  <div className="form-field">
                    <label htmlFor="planOutput">Generated Plan</label>
                    <div className="plan-output-wrap">
                      <textarea
                        id="planOutput"
                        ref={planOutputRef}
                        value={planText}
                        readOnly
                        className="text-block text-block-large"
                      />
                      <button
                        onClick={handleCopyPlan}
                        onMouseDown={() => setCopyPressed(true)}
                        onMouseUp={() => setCopyPressed(false)}
                        onMouseLeave={() => setCopyPressed(false)}
                        type="button"
                        className="copy-button"
                        style={{
                          right: planHasScroll ? "20px" : "6px",
                          transform: copyPressed ? "scale(0.96)" : "scale(1)"
                        }}
                        aria-label="Copy plan text"
                      >
                        {copyStatus === "success" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="status-inline">
                    Validate all generated commands before applying changes to your cluster.
                  </div>

                  <div className="button-row top-gap">
                    <button className="button secondary" onClick={() => void submitPlan()} disabled={planLoading}>
                      {planLoading ? "Regenerating..." : "Regenerate Plan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
