import { Codex } from "@openai/codex-sdk";
function createCodexClient() {
    return new Codex();
}
function isMockMode() {
    return String(process.env.CODEX_MOCK_MODE || "").toLowerCase() === "true";
}
export function redactSensitive(value) {
    if (!value)
        return { redactedText: value, redactionCount: 0 };
    const patterns = [
        { regex: /\b(?:sk|rk|pk|tok|key)-[A-Za-z0-9_-]{8,}\b/g, label: "[REDACTED_KEY]" },
        { regex: /\bAKIA[0-9A-Z]{16}\b/g, label: "[REDACTED_AWS_KEY]" },
        { regex: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, label: "[REDACTED_CERT]" },
        { regex: /\b\d{12,}\b/g, label: "[REDACTED_NUMBER]" }
    ];
    let redactionCount = 0;
    let result = value;
    for (const pattern of patterns) {
        result = result.replace(pattern.regex, () => {
            redactionCount += 1;
            return pattern.label;
        });
    }
    return { redactedText: result, redactionCount };
}
function buildPrompt(input) {
    const { issue, userContext, allowList } = input;
    const userRedaction = redactSensitive(userContext || "");
    const errorRedaction = redactSensitive(issue.context?.errorText || "");
    const eventsRedaction = redactSensitive(issue.context?.eventsTable || "");
    const definitionRedaction = redactSensitive(issue.context?.definition || "");
    const contextBlocks = [
        `Issue: ${issue.title}`,
        `Severity: ${issue.severity}`,
        `Kind: ${issue.kind}`,
        `Namespace: ${issue.namespace}`,
        `Name: ${issue.name}`,
        `DetectedAt: ${issue.detectedAt}`,
        "",
        "Context:",
        `Error: ${errorRedaction.redactedText || "N/A"}`,
        "Events:",
        eventsRedaction.redactedText || "No events provided.",
        "Definition:",
        definitionRedaction.redactedText || "No definition provided."
    ];
    const policyBlock = [
        "AccessPolicy:",
        `Namespaces: ${allowList.namespaceAllowList.join(", ") || "none"}`,
        `Kinds: ${allowList.kindAllowList.join(", ") || "none"}`
    ];
    const guardrails = [
        "Guardrails:",
        "- Allowed: read-only checks, rollout restart suggestion, config diff suggestions.",
        "- Disallowed: delete, scale to zero, change PVC, change network policy.",
        "- Each step must include impact + validation."
    ];
    const instructions = [
        "You are a Kubernetes incident assistant.",
        "Return JSON only in the combined schema.",
        "Combined schema fields:",
        "- quickFix: { summary, assumptions, steps, fallback }",
        "- rootCauseHypotheses: string[]",
        "- evidenceToGather: string[]",
        "- recommendations: string[]",
        "quickFix.steps must include stepId, description, kubectl (string or null), validation, rollback (string or null), impact."
    ];
    const promptSections = [
        instructions.join("\n"),
        guardrails.join("\n"),
        policyBlock.join("\n"),
        contextBlocks.join("\n")
    ];
    if (userRedaction.redactedText.trim()) {
        promptSections.push("AdditionalUserContext:\n" + userRedaction.redactedText);
    }
    const prompt = promptSections.join("\n\n");
    return {
        prompt,
        meta: {
            issueId: issue.id,
            issueTitle: issue.title,
            namespace: issue.namespace,
            kind: issue.kind,
            hasUserContext: Boolean(userContext && userContext.trim()),
            redactionCount: userRedaction.redactionCount +
                errorRedaction.redactionCount +
                eventsRedaction.redactionCount +
                definitionRedaction.redactionCount
        }
    };
}
function parseJsonResponse(raw, fallback) {
    if (!raw)
        return fallback;
    try {
        return JSON.parse(raw);
    }
    catch (err) {
        return fallback;
    }
}
function ensureCodexPlan(raw, fallback) {
    if (!raw || typeof raw !== "object")
        return fallback;
    if (!raw.quickFix || typeof raw.quickFix !== "object")
        return fallback;
    const normalizeList = (items) => items
        .map((item) => {
        if (typeof item === "string")
            return item;
        if (item && typeof item === "object") {
            if (typeof item.text === "string")
                return item.text;
            if (typeof item.description === "string")
                return item.description;
            if (typeof item.summary === "string")
                return item.summary;
            return JSON.stringify(item);
        }
        return String(item ?? "");
    })
        .filter((item) => item.trim().length > 0);
    const quickFix = raw.quickFix;
    if (!quickFix.summary || !Array.isArray(quickFix.steps)) {
        return fallback;
    }
    return {
        quickFix: {
            summary: String(quickFix.summary),
            assumptions: normalizeList(Array.isArray(quickFix.assumptions) ? quickFix.assumptions : []),
            steps: Array.isArray(quickFix.steps) ? quickFix.steps : [],
            fallback: String(quickFix.fallback || "")
        },
        rootCauseHypotheses: normalizeList(Array.isArray(raw.rootCauseHypotheses) ? raw.rootCauseHypotheses : []),
        evidenceToGather: normalizeList(Array.isArray(raw.evidenceToGather) ? raw.evidenceToGather : []),
        recommendations: normalizeList(Array.isArray(raw.recommendations) ? raw.recommendations : [])
    };
}
function logPromptMeta(meta) {
    console.info("Codex prompt metadata", meta);
}
function extractResponseText(result) {
    if (typeof result === "string")
        return result;
    if (result && typeof result.finalResponse === "string") {
        return result.finalResponse;
    }
    if (result && typeof result.response === "string") {
        return result.response;
    }
    return JSON.stringify(result ?? "");
}
async function callCodex(input, fallback) {
    const { prompt, meta } = buildPrompt(input);
    logPromptMeta(meta);
    const client = createCodexClient();
    const thread = client.startThread();
    const result = await thread.run(prompt);
    const content = extractResponseText(result);
    const parsed = parseJsonResponse(content, fallback);
    return parsed;
}
export async function generateCodexPlan(input, fallback) {
    const result = await callCodex(input, fallback);
    return ensureCodexPlan(result, fallback);
}
export { isMockMode };
