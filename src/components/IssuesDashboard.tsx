"use client";

/**
 * Presents issue triage workflows, plan generation, and operator context management.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { loadDismissedIssueIds, saveDismissedIssueIds } from "@/lib/dismissedIssues";
import { generatePlan, getCodexAuthStatus, listIssues } from "@/lib/k8sClient";
import { generateLocalPlan } from "@/lib/planGenerator";
import type { CodexAuthStatus, CodexPlan, Issue } from "@/lib/types";

// Renders the primary issue dashboard and associated planning modal.
export default function IssuesDashboard() {
  const e2eDeterministicFallbackEnabled = process.env.NEXT_PUBLIC_CLUSTERCODEX_E2E_MODE === "1";
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dismissedIssues, setDismissedIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planWarning, setPlanWarning] = useState("");
  const [planSource, setPlanSource] = useState("");
  const [planResult, setPlanResult] = useState<CodexPlan | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState("");
  const [view, setView] = useState<"active" | "dismissed">("active");
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [copyPressed, setCopyPressed] = useState(false);
  const [planHasScroll, setPlanHasScroll] = useState(false);
  const [codexOAuthConnected, setCodexOAuthConnected] = useState<boolean | null>(null);
  const [codexAuthMethod, setCodexAuthMethod] = useState<CodexAuthStatus["method"] | null>(null);
  const [codexProvider, setCodexProvider] = useState("");
  const [codexAuthDetails, setCodexAuthDetails] = useState("");
  const planOutputRef = useRef<HTMLTextAreaElement | null>(null);

  // Loads issues and applies persisted dismiss-state filtering.
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

  // Performs the initial issue load on first render.
  useEffect(() => {
    void loadData();
  }, []);

  // Refreshes auth readiness details when the planning modal opens.
  useEffect(() => {
    if (!planOpen || !selectedIssue) {
      setCodexOAuthConnected(null);
      setCodexAuthMethod(null);
      setCodexProvider("");
      setCodexAuthDetails("");
      return;
    }

    let cancelled = false;

    // Fetches auth details while guarding against stale updates.
    const loadCodexAuthStatus = async () => {
      setCodexOAuthConnected(null);
      setCodexAuthMethod(null);
      setCodexProvider("");
      setCodexAuthDetails("");
      try {
        const status = await getCodexAuthStatus();
        if (cancelled) {
          return;
        }
        setCodexOAuthConnected(status.authenticated);
        setCodexAuthMethod(status.method);
        setCodexProvider(status.provider);
        setCodexAuthDetails(status.details);
      } catch {
        if (cancelled) {
          return;
        }
        setCodexOAuthConnected(null);
        setCodexAuthMethod(null);
        setCodexProvider("");
        setCodexAuthDetails("Unable to confirm Codex OAuth status.");
      }
    };

    void loadCodexAuthStatus();

    return () => {
      cancelled = true;
    };
  }, [planOpen, selectedIssue]);

  // Resets transient modal state and closes the planning view.
  const closeModal = () => {
    setSelectedIssue(null);
    setPlanOpen(false);
    setUserContext("");
    setContextSnapshot("");
    setPlanLoading(false);
    setPlanError("");
    setPlanWarning("");
    setPlanSource("");
    setPlanResult(null);
    setCodexOAuthConnected(null);
    setCodexAuthMethod(null);
    setCodexProvider("");
    setCodexAuthDetails("");
  };

  // Moves an issue from active to dismissed and persists that choice.
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

  // Restores a dismissed issue back into the active list.
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

  // Opens plan generation and seeds the context editor with captured signals.
  const openModal = (issue: Issue) => {
    setSelectedIssue(issue);
    setPlanOpen(true);
    setPlanResult(null);
    setPlanError("");
    setPlanWarning("");
    setPlanSource("");

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

  // Requests a live plan and falls back locally when deterministic E2E mode is enabled.
  const submitPlan = async () => {
    if (!selectedIssue) {
      return;
    }

    setPlanLoading(true);
    setPlanError("");
    setPlanWarning("");

    try {
      const result = await generatePlan(selectedIssue, contextSnapshot, userContext);
      setPlanResult(result.plan);
      setPlanSource(
        result.provider === "codex" ? `Live Codex SDK (${result.model})` : `Local fallback (${result.model})`
      );
      if (result.warning) {
        setPlanWarning(result.warning);
      }
    } catch (error) {
      if (e2eDeterministicFallbackEnabled) {
        const mergedContext = [contextSnapshot.trim(), userContext.trim()].filter(Boolean).join("\n\n");
        const fallback = generateLocalPlan(selectedIssue, mergedContext);
        setPlanResult(fallback);
        setPlanSource("Local fallback (client-side deterministic planner, E2E mode)");
        setPlanWarning("Failed to contact plan API in E2E mode. Using deterministic fallback.");
      } else {
        const message = error instanceof Error ? error.message : "Failed to generate plan.";
        setPlanError(message);
      }
    } finally {
      setPlanLoading(false);
    }
  };

  // Formats the generated plan into readable plain text for display and copy actions.
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

  // Tracks whether the read-only output has a visible scrollbar for copy button positioning.
  useEffect(() => {
    const node = planOutputRef.current;
    if (!node) {
      setPlanHasScroll(false);
      return;
    }

    setPlanHasScroll(node.scrollHeight > node.clientHeight + 1);
  }, [planText]);

  // Copies generated plan output to the clipboard with transient success/error feedback.
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

  // Derives a concise auth status message from current auth mode and readiness signals.
  const codexStatusMessage = useMemo(() => {
    if (codexAuthDetails.toLowerCase().includes("unable to locate codex cli binaries")) {
      return "Codex runtime is unavailable because local CLI binaries are missing.";
    }

    if (codexOAuthConnected === null) {
      return "Checking Codex auth status...";
    }

    if (codexAuthMethod === "local_provider") {
      return "Codex is configured for a local LLM provider.";
    }

    if (codexAuthMethod === "api_key") {
      return codexOAuthConnected
        ? "Codex API key auth is configured."
        : "Codex API key auth is selected, but no API key is configured.";
    }

    if (codexAuthMethod === "auto") {
      return codexOAuthConnected
        ? "Codex auto auth mode is ready."
        : "Codex auto auth mode is not ready.";
    }

    if (codexOAuthConnected) {
      return "Codex OAuth is connected.";
    }

    return "Codex OAuth is not connected.";
  }, [codexAuthDetails, codexOAuthConnected, codexAuthMethod]);

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

              <div className="status-inline">
                {codexStatusMessage}
              </div>

              {codexProvider && (
                <div className="status-inline">
                  Provider: {codexProvider}
                </div>
              )}

              {codexAuthDetails && (
                <div className="status-inline">
                  Status: {codexAuthDetails}
                </div>
              )}

              <div className="status-inline">
                Live generation runs through the Codex SDK with structured JSON output.
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
                  {planSource && <div className="status-inline">Generated by: {planSource}</div>}
                  {planWarning && <div className="status-inline">{planWarning}</div>}
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
