"use client";

/**
 * Presents issue triage workflows, plan generation, and operator context management.
 */
import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { loadDismissedIssueIds, saveDismissedIssueIds } from "@/lib/dismissedIssues";
import { generatePlan, getCodexAuthStatus, listIssues } from "@/lib/k8sClient";
import { generateLocalPlan } from "@/lib/planGenerator";
import type { CodexAuthStatus, CodexPlan, Issue } from "@/lib/types";

/** Renders the primary issue dashboard and associated planning modal. */
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
  const [codexOAuthConnected, setCodexOAuthConnected] = useState<boolean | null>(null);
  const [codexAuthMethod, setCodexAuthMethod] = useState<CodexAuthStatus["method"] | null>(null);
  const [codexProvider, setCodexProvider] = useState("");
  const [codexAuthDetails, setCodexAuthDetails] = useState("");

  /** Loads issues and applies persisted dismiss-state filtering. */
  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const allIssues = await listIssues();
      const dismissedIds = loadDismissedIssueIds();

      setIssues(allIssues.filter((issue) => !dismissedIds.has(issue.id)));
      setDismissedIssues(allIssues.filter((issue) => dismissedIds.has(issue.id)));
    } catch {
      setError(
        "Failed to load cluster issues. Verify your kubeconfig and cluster permissions are valid."
      );
    } finally {
      setLoading(false);
    }
  };

  /** Performs the initial issue load on first render. */
  useEffect(() => {
    void loadData();
  }, []);

  /** Refreshes auth readiness details when the planning modal opens. */
  useEffect(() => {
    if (!planOpen || !selectedIssue) {
      setCodexOAuthConnected(null);
      setCodexAuthMethod(null);
      setCodexProvider("");
      setCodexAuthDetails("");
      return;
    }

    let cancelled = false;

    /** Fetches auth details while guarding against stale updates. */
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

  /** Resets transient modal state and closes the planning view. */
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
    setCopyStatus("idle");
    setCodexOAuthConnected(null);
    setCodexAuthMethod(null);
    setCodexProvider("");
    setCodexAuthDetails("");
  };

  /** Moves an issue from active to dismissed and persists that choice. */
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

  /** Restores a dismissed issue back into the active list. */
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

  /** Opens plan generation and seeds the context editor with captured signals. */
  const openModal = (issue: Issue) => {
    setSelectedIssue(issue);
    setPlanOpen(true);
    setPlanResult(null);
    setPlanError("");
    setPlanWarning("");
    setPlanSource("");
    setCopyStatus("idle");

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

  /** Requests a live plan and falls back locally when deterministic E2E mode is enabled. */
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
    } catch (submitError) {
      if (e2eDeterministicFallbackEnabled) {
        const mergedContext = [contextSnapshot.trim(), userContext.trim()].filter(Boolean).join("\n\n");
        const fallback = generateLocalPlan(selectedIssue, mergedContext);
        setPlanResult(fallback);
        setPlanSource("Local fallback (client-side deterministic planner, E2E mode)");
        setPlanWarning("Failed to contact plan API in E2E mode. Using deterministic fallback.");
      } else {
        const message = submitError instanceof Error ? submitError.message : "Failed to generate plan.";
        setPlanError(message);
      }
    } finally {
      setPlanLoading(false);
    }
  };

  /** Formats the generated plan into readable plain text for display and copy actions. */
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

  /** Copies generated plan output to the clipboard with transient success/error feedback. */
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
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  /** Derives a concise auth status message from current auth mode and readiness signals. */
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

  const currentIssues = view === "active" ? issues : dismissedIssues;

  return (
    <>
      <Card className="surface-glow">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Detected Issues</CardTitle>
            <CardDescription>
              Investigate active incidents and generate structured remediation plans.
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => void loadData()} disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Refresh
              </>
            )}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <ErrorBanner message={error} />

          <div className="flex flex-wrap gap-2">
            <Button variant={view === "active" ? "default" : "secondary"} onClick={() => setView("active")}>
              Active
            </Button>
            <Button
              variant={view === "dismissed" ? "default" : "secondary"}
              onClick={() => setView("dismissed")}
            >
              Dismissed
            </Button>
          </div>

          {loading ? (
            <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-8 text-sm text-muted-foreground">
              Loading issues...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/45">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Namespace</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentIssues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {view === "active" ? "No issues detected." : "No dismissed issues."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentIssues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell>{issue.kind}</TableCell>
                        <TableCell>{issue.namespace}</TableCell>
                        <TableCell>{issue.name}</TableCell>
                        <TableCell>{new Date(issue.detectedAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {view === "active" ? (
                              <>
                                <Button variant="success" size="sm" onClick={() => openModal(issue)}>
                                  Cluster Codex
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDismiss(issue.id)}
                                >
                                  Dismiss
                                </Button>
                              </>
                            ) : (
                              <Button variant="secondary" size="sm" onClick={() => handleRestore(issue.id)}>
                                Restore
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIssue && (
        <Dialog
          open={planOpen && Boolean(selectedIssue)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              closeModal();
            }
          }}
        >
          <DialogContent className="max-h-[88vh] gap-0 overflow-hidden border-border/70 bg-popover p-0 sm:max-w-5xl">
            <div className="border-b border-border/70 px-6 py-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Cluster Codex
                </DialogTitle>
                <DialogDescription>
                  Generate remediation guidance from live issue context and operator notes.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="max-h-[calc(88vh-95px)] space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <label htmlFor="context" className="text-sm font-medium text-muted-foreground">
                  Cluster Issue Context
                </label>
                <Textarea
                  id="context"
                  value={contextSnapshot}
                  onChange={(event) => setContextSnapshot(event.target.value)}
                  className="min-h-[320px]"
                />
                <p className="text-xs text-muted-foreground">
                  Edit captured context before generating a remediation plan.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="userContext" className="text-sm font-medium text-muted-foreground">
                  Additional User Context
                </label>
                <Textarea
                  id="userContext"
                  value={userContext}
                  onChange={(event) => setUserContext(event.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>{codexStatusMessage}</p>
                {codexProvider && <p>Provider: {codexProvider}</p>}
                {codexAuthDetails && <p>Status: {codexAuthDetails}</p>}
                <p>Live generation runs through the Codex SDK with structured JSON output.</p>
              </div>

              <ErrorBanner message={planError} />

              {!planText && (
                <div className="flex items-center gap-2">
                  <Button onClick={() => void submitPlan()} disabled={planLoading}>
                    {planLoading ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Plan"
                    )}
                  </Button>
                </div>
              )}

              {planText && (
                <div className="space-y-4">
                  {planSource && <p className="text-xs text-muted-foreground">Generated by: {planSource}</p>}
                  {planWarning && <p className="text-xs text-amber-300">{planWarning}</p>}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="planOutput" className="text-sm font-medium text-muted-foreground">
                        Generated Plan
                      </label>
                      <Button variant="secondary" size="sm" onClick={handleCopyPlan}>
                        <ClipboardCopy className="size-4" />
                        {copyStatus === "success"
                          ? "Copied"
                          : copyStatus === "error"
                            ? "Copy failed"
                            : "Copy"}
                      </Button>
                    </div>
                    <Textarea id="planOutput" value={planText} readOnly className="min-h-[320px]" />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Validate all generated commands before applying changes to your cluster.
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <Button variant="secondary" onClick={() => void submitPlan()} disabled={planLoading}>
                      {planLoading ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate Plan"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
