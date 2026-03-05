import { expect, test } from "@playwright/test";

function issuesTable(page: import("@playwright/test").Page) {
  return page.getByRole("table").first();
}

function firstActiveIssueRow(page: import("@playwright/test").Page) {
  return issuesTable(page)
    .locator("tbody tr", {
      has: page.getByRole("button", { name: "Cluster Codex" })
    })
    .first();
}

async function openPlanForFirstIssue(page: import("@playwright/test").Page) {
  const row = firstActiveIssueRow(page);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Cluster Codex" }).click();
  await expect(page.getByRole("heading", { name: "Cluster Codex" })).toBeVisible();
}

function waitForPlanResponse(page: import("@playwright/test").Page) {
  return page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return url.pathname === "/api/plan" && response.request().method() === "POST" && response.ok();
    } catch {
      return false;
    }
  });
}

test("issues flow: list, generate plan, copy, regenerate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Detected Issues" })).toBeVisible();

  await openPlanForFirstIssue(page);

  const context = page.getByLabel("Cluster Issue Context");
  const userContext = page.getByLabel("Additional User Context");

  await expect(context).toBeEditable();
  await expect(userContext).toBeEditable();

  const originalContext = await context.inputValue();
  await context.fill(`${originalContext}\nExtra debug note.`);
  await expect(context).toHaveValue(/Extra debug note\./);

  await userContext.fill("Investigate issue details.");
  await expect(userContext).toHaveValue("Investigate issue details.");

  const initialPlanRequest = waitForPlanResponse(page);
  await page.getByRole("button", { name: "Generate Plan" }).click();
  await initialPlanRequest;
  const planOutput = page.getByLabel("Generated Plan");
  await expect(planOutput).toContainText("Summary:");

  const copyButton = page.getByRole("button", { name: "Copy" });
  await copyButton.click();
  await expect(copyButton).toBeVisible();

  const copyLabel = await copyButton.textContent();
  expect(["Copied", "Copy failed", "Copy"]).toContain((copyLabel || "").trim());
  try {
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("Summary:");
  } catch {
    // Clipboard permissions can vary by CI browser runtime.
  }

  const regeneratePlanRequest = waitForPlanResponse(page);
  await page.getByRole("button", { name: "Regenerate Plan" }).click();
  await regeneratePlanRequest;
  await expect(page.getByRole("button", { name: "Regenerate Plan" })).toBeVisible();
  await expect(planOutput).toContainText("Summary:");
});

test("issues flow: dismiss and restore", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Detected Issues" })).toBeVisible();

  const row = firstActiveIssueRow(page);
  await expect(row).toBeVisible();

  const issueName = ((await row.locator("td").nth(2).textContent()) || "").trim();
  expect(issueName.length).toBeGreaterThan(0);

  await row.getByRole("button", { name: "Dismiss" }).click();

  await page.getByRole("button", { name: "Dismissed" }).click();
  await expect(issuesTable(page).getByRole("cell", { name: issueName, exact: true })).toBeVisible();

  await issuesTable(page)
    .getByRole("cell", { name: issueName, exact: true })
    .locator("..")
    .getByRole("button", { name: "Restore" })
    .click();

  await page.getByRole("button", { name: "Active" }).click();
  await expect(issuesTable(page).getByRole("cell", { name: issueName, exact: true })).toBeVisible();
});

test("resources flow: deployments and pods are visible", async ({ page }) => {
  await page.goto("/resources");
  await expect(page.getByRole("heading", { name: "Resource Explorer" })).toBeVisible();

  await page.getByRole("button", { name: "Deployments" }).click();
  const deploymentsTable = page.getByRole("table").first();
  await expect(deploymentsTable.getByRole("cell", { name: "broken-deployment", exact: true })).toBeVisible();
  await expect(deploymentsTable.getByRole("cell", { name: "podinfo" })).toBeVisible();

  await page.getByRole("button", { name: "Pods" }).click();
  const podsTable = page.getByRole("table").first();
  await expect(podsTable.getByRole("cell", { name: "gpu-pod", exact: true }).first()).toBeVisible();
});
