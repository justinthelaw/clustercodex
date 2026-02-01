import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import ErrorBanner from "../components/ErrorBanner";

type Issue = {
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

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dismissedIssues, setDismissedIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [planType, setPlanType] = useState<"short-term" | "long-term" | null>(
    null,
  );
  const [userContext, setUserContext] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planResult, setPlanResult] = useState<any | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState("");
  const [view, setView] = useState<"active" | "dismissed">("active");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [activeResponse, dismissedResponse] = await Promise.all([
          api.get<Issue[]>("/api/issues"),
          api.get<Issue[]>("/api/issues/dismissed"),
        ]);
        if (!mounted) return;
        setIssues(activeResponse.data);
        setDismissedIssues(dismissedResponse.data);
        setLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.response?.data?.error || "Failed to load issues");
        setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const closeModal = () => {
    setSelectedIssue(null);
    setPlanType(null);
    setUserContext("");
    setContextSnapshot("");
    setPlanLoading(false);
    setPlanError("");
    setPlanResult(null);
  };

  const handleDismiss = async (issueId: string) => {
    try {
      await api.post("/api/issues/dismiss", { issueId });
      setIssues((prev) => {
        const issue = prev.find((item) => item.id === issueId);
        if (issue) {
          setDismissedIssues((dismissedPrev) => {
            if (dismissedPrev.some((item) => item.id === issue.id)) {
              return dismissedPrev;
            }
            return [issue, ...dismissedPrev];
          });
        }
        return prev.filter((item) => item.id !== issueId);
      });
    } catch (err) {
      // ignore for now
    }
  };

  const handleRestore = async (issueId: string) => {
    try {
      await api.post("/api/issues/restore", { issueId });
      setDismissedIssues((prev) => {
        const issue = prev.find((item) => item.id === issueId);
        if (issue) {
          setIssues((activePrev) => {
            if (activePrev.some((item) => item.id === issue.id)) {
              return activePrev;
            }
            return [issue, ...activePrev];
          });
        }
        return prev.filter((item) => item.id !== issueId);
      });
    } catch (err) {
      // ignore for now
    }
  };

  const openModal = (issue: Issue, type: "short-term" | "long-term") => {
    setSelectedIssue(issue);
    setPlanType(type);
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
        definitionBlock,
      ];
      setContextSnapshot(blocks.join("\n"));
    } else {
      setContextSnapshot("");
    }
  };

  const submitPlan = async () => {
    if (!selectedIssue || !planType) return;
    setPlanLoading(true);
    setPlanError("");

    const mergedContext = [contextSnapshot.trim(), userContext.trim()]
      .filter(Boolean)
      .join("\\n\\n");

    try {
      const endpoint =
        planType === "short-term"
          ? "/api/plans/short-term"
          : "/api/plans/long-term";
      const response = await api.post(endpoint, {
        issueId: selectedIssue.id,
        userContext: mergedContext,
      });
      setPlanResult(response.data);
    } catch (err: any) {
      setPlanError(err?.response?.data?.error || "Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const planText = useMemo(() => {
    if (!planResult || !planType) return "";

    if (planType === "short-term") {
      const lines = [
        `Summary: ${planResult.summary || ""}`,
        `Risk: ${planResult.riskLevel || ""}`,
        "Steps:",
      ];
      (planResult.steps || []).forEach((step: any, idx: number) => {
        lines.push(`${idx + 1}. ${step.description || ""}`);
        if (step.kubectl) lines.push(`   kubectl: ${step.kubectl}`);
        if (step.validation) lines.push(`   Validation: ${step.validation}`);
        if (step.rollback) lines.push(`   Rollback: ${step.rollback}`);
        if (step.impact) lines.push(`   Impact: ${step.impact}`);
      });
      lines.push(`Fallback: ${planResult.fallback || ""}`);
      return lines.join("\n");
    }

    const lines = [
      `Summary: ${planResult.summary || ""}`,
      `Risk: ${planResult.riskLevel || ""}`,
      "Root Cause Hypotheses:",
      ...(planResult.rootCauseHypotheses || []).map(
        (item: string) => `- ${item}`,
      ),
      "Evidence to Gather:",
      ...(planResult.evidenceToGather || []).map((item: string) => `- ${item}`),
      "Recommendations:",
      ...(planResult.recommendations || []).map((item: string) => `- ${item}`),
    ];
    return lines.join("\n");
  }, [planResult, planType]);

  return (
    <div className="card">
      <h2>Detected Issues</h2>
      <ErrorBanner message={error} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          className={`button ${view === "active" ? "" : "secondary"}`}
          onClick={() => setView("active")}
        >
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
        <table className="table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Namespace</th>
              <th>Name</th>
              <th>Detected</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(view === "active" ? issues : dismissedIssues).length === 0 ? (
              <tr>
                <td colSpan={5}>
                  {view === "active"
                    ? "No issues detected."
                    : "No dismissed issues."}
                </td>
              </tr>
            ) : (
              (view === "active" ? issues : dismissedIssues).map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.kind}</td>
                  <td>{issue.namespace}</td>
                  <td>{issue.name}</td>
                  <td>{new Date(issue.detectedAt).toLocaleString()}</td>
                  <td>
                    <div
                      className="table-actions"
                      style={{ display: "flex", gap: "8px" }}
                    >
                      {view === "active" ? (
                        <>
                          <button
                            className="button"
                            onClick={() => openModal(issue, "short-term")}
                          >
                            Quick Fix
                          </button>
                          <button
                            className="button tertiary"
                            onClick={() => openModal(issue, "long-term")}
                          >
                            Long-term Fix
                          </button>
                          <button
                            className="button danger"
                            onClick={() => handleDismiss(issue.id)}
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <button
                          className="button success"
                          onClick={() => handleRestore(issue.id)}
                        >
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
      )}

      {selectedIssue && planType && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "820px",
              width: "92%",
              maxHeight: "85vh",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                marginBottom: "16px"
              }}
            >
              <h2 style={{ margin: 0 }}>
                {planType === "short-term"
                  ? "Quick Fix"
                  : "Long-Term Fix"}
              </h2>
              <button
                className="button secondary"
                onClick={closeModal}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "4px 2px",
                maxHeight: planText ? "70vh" : undefined,
                overflowY: planText ? "scroll" : undefined,
              }}
            >
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="context">Cluster Issue Context</label>
                <textarea
                  id="context"
                  value={contextSnapshot}
                  onChange={(event) => setContextSnapshot(event.target.value)}
                  style={{
                    background: "#0b0b0b",
                    color: "#e5e5e5",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #202020",
                    whiteSpace: "pre-wrap",
                    height: "500px",
                    overflowY: "auto",
                    margin: 0,
                    width: "100%",
                    resize: "none",
                  }}
                />
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9ca3af",
                    marginLeft: "6px",
                  }}
                >
                  Please scrub any sensitive data before generating a plan.
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="userContext">Additional User Context</label>
                <textarea
                  id="userContext"
                  value={userContext}
                  onChange={(event) => setUserContext(event.target.value)}
                  style={{
                    background: "#0b0b0b",
                    color: "#e5e5e5",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #202020",
                    whiteSpace: "pre-wrap",
                    height: "100px",
                    overflowY: "auto",
                    margin: 0,
                    width: "100%",
                    resize: "none",
                  }}
                />
              </div>
              {planError && <ErrorBanner message={planError} />}
              {!planText && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "12px",
                  }}
                >
                  <button
                    className="button"
                    onClick={submitPlan}
                    disabled={planLoading}
                  >
                    {planLoading ? "Generating..." : "Generate plan"}
                  </button>
                </div>
              )}
              {planText && (
                <div>
                  <div className="form-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="planOutput">Generated Plan</label>
                    <textarea
                      id="planOutput"
                      value={planText}
                      readOnly
                      style={{
                        background: "#0b0b0b",
                        color: "#e5e5e5",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: "1px solid #202020",
                        whiteSpace: "pre-wrap",
                        height: "500px",
                        overflowY: "auto",
                        margin: 0,
                        width: "100%",
                        resize: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      marginTop: "4px",
                      marginLeft: "6px",
                    }}
                  >
                    AI can make mistakes. Please validate all information for
                    yourself.
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <button
                      className="button secondary"
                      onClick={submitPlan}
                      disabled={planLoading}
                    >
                      {planLoading ? "Regenerating..." : "Regenerate plan"}
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
