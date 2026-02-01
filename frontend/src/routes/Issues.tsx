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
};

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [planType, setPlanType] = useState<"remediation" | "long-term" | null>(null);
  const [userContext, setUserContext] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planResult, setPlanResult] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<Issue[]>("/api/issues")
      .then((response) => {
        if (!mounted) return;
        setIssues(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.error || "Failed to load issues");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const closeModal = () => {
    setSelectedIssue(null);
    setPlanType(null);
    setUserContext("");
    setPlanLoading(false);
    setPlanError("");
    setPlanResult(null);
  };

  const openModal = (issue: Issue, type: "remediation" | "long-term") => {
    setSelectedIssue(issue);
    setPlanType(type);
    setPlanResult(null);
    setPlanError("");
  };

  const submitPlan = async () => {
    if (!selectedIssue || !planType) return;
    setPlanLoading(true);
    setPlanError("");

    try {
      const endpoint = planType === "remediation" ? "/api/plans/remediation" : "/api/plans/long-term";
      const response = await api.post(endpoint, {
        issueId: selectedIssue.id,
        userContext
      });
      setPlanResult(response.data);
    } catch (err: any) {
      setPlanError(err?.response?.data?.error || "Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const renderedPlan = useMemo(() => {
    if (!planResult || !planType) return null;

    if (planType === "remediation") {
      return (
        <div>
          <p><strong>Summary:</strong> {planResult.summary}</p>
          <p><strong>Risk:</strong> {planResult.riskLevel}</p>
          <div>
            <strong>Steps</strong>
            <ol>
              {planResult.steps?.map((step: any) => (
                <li key={step.stepId}>
                  <div>{step.description}</div>
                  {step.kubectl && (
                    <div style={{ marginTop: "6px" }}>
                      <code>{step.kubectl}</code>
                      <button
                        className="button secondary"
                        style={{ marginLeft: "8px" }}
                        onClick={() => navigator.clipboard.writeText(step.kubectl)}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <div><em>Validation:</em> {step.validation}</div>
                  {step.rollback && <div><em>Rollback:</em> {step.rollback}</div>}
                  <div><em>Impact:</em> {step.impact}</div>
                </li>
              ))}
            </ol>
          </div>
          <p><strong>Fallback:</strong> {planResult.fallback}</p>
        </div>
      );
    }

    return (
      <div>
        <p><strong>Summary:</strong> {planResult.summary}</p>
        <p><strong>Risk:</strong> {planResult.riskLevel}</p>
        <div>
          <strong>Root Cause Hypotheses</strong>
          <ul>
            {planResult.rootCauseHypotheses?.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Evidence to Gather</strong>
          <ul>
            {planResult.evidenceToGather?.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Recommendations</strong>
          <ul>
            {planResult.recommendations?.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }, [planResult, planType]);

  return (
    <div className="card">
      <h2>Detected Issues</h2>
      <ErrorBanner message={error} />
      {loading ? (
        <div>Loading issues...</div>
      ) : issues.length === 0 ? (
        <div>No issues detected.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Kind</th>
              <th>Namespace</th>
              <th>Name</th>
              <th>Detected</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td>{issue.title}</td>
                <td>{issue.severity}</td>
                <td>{issue.kind}</td>
                <td>{issue.namespace}</td>
                <td>{issue.name}</td>
                <td>{new Date(issue.detectedAt).toLocaleString()}</td>
                <td>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="button" onClick={() => openModal(issue, "remediation")}>
                      Remediation
                    </button>
                    <button className="button secondary" onClick={() => openModal(issue, "long-term")}>
                      Long-term
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
            padding: "24px"
          }}
        >
          <div className="card" style={{ maxWidth: "720px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>{planType === "remediation" ? "Remediation Plan" : "Long-term Plan"}</h3>
              <button className="button secondary" onClick={closeModal}>
                Close
              </button>
            </div>
            <p>
              <strong>{selectedIssue.title}</strong> · {selectedIssue.namespace}/{selectedIssue.name}
            </p>
            <div className="form-field">
              <label htmlFor="context">Optional context</label>
              <input
                id="context"
                type="text"
                value={userContext}
                onChange={(event) => setUserContext(event.target.value)}
                placeholder="We just deployed v2."
              />
            </div>
            {planError && <ErrorBanner message={planError} />}
            <button className="button" onClick={submitPlan} disabled={planLoading}>
              {planLoading ? "Generating..." : "Generate plan"}
            </button>
            <div style={{ marginTop: "16px" }}>
              {planLoading && <div>Generating plan...</div>}
              {renderedPlan}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
