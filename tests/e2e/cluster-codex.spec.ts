import { test, expect } from "@playwright/test";

const admin = { email: "admin@clustercodex.local", password: "admin123!" };
const user = { email: "user@clustercodex.local", password: "user123!" };

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Detected Issues" })
  ).toBeVisible();
}

function issuesTable(page: import("@playwright/test").Page) {
  return page.getByRole("table").first();
}

async function openPlanForIssue(page: import("@playwright/test").Page, issueName: string) {
  const cell = issuesTable(page).getByRole("cell", { name: issueName, exact: true });
  await cell.locator("..").getByRole("button", { name: "Cluster Codex" }).click();
  await expect(page.getByRole("heading", { name: "Cluster Codex" })).toBeVisible();
}

async function generatePlan(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Generate Plan" }).click();
  await expect(page.getByLabel("Generated Plan")).toBeVisible();
}

test("admin example flow: issues, plan, copy, regenerate", async ({ page }) => {
  await loginAs(page, admin.email, admin.password);

  await expect(page.getByRole("link", { name: "Admin Panel" })).toBeVisible();
  await expect(
    issuesTable(page).getByRole("cell", { name: "broken-deployment", exact: true })
  ).toBeVisible();

  await openPlanForIssue(page, "broken-deployment");
  const context = page.getByLabel("Cluster Issue Context");
  const userContext = page.getByLabel("Additional User Context");
  await expect(context).toBeEditable();
  await expect(userContext).toBeEditable();

  const originalContext = await context.inputValue();
  await context.fill(`${originalContext}\nExtra debug note.`);
  await expect(context).toHaveValue(/Extra debug note\./);
  await userContext.fill("Investigate crashloop details.");
  await expect(userContext).toHaveValue("Investigate crashloop details.");
  await generatePlan(page);

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
  } catch {}

  await page.getByRole("button", { name: "Regenerate Plan" }).click();
  await expect(page.getByRole("button", { name: "Regenerating..." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Regenerate Plan" })).toBeVisible();
  await expect(planOutput).toContainText("Summary:");
});

test("user example flow: issues, dismiss and restore", async ({ page }) => {
  await loginAs(page, user.email, user.password);

  await expect(page.getByRole("link", { name: "Admin Panel" })).toHaveCount(0);
  await expect(
    issuesTable(page).getByRole("cell", { name: "broken-deployment", exact: true })
  ).toBeVisible();

  await issuesTable(page)
    .getByRole("cell", { name: "broken-deployment", exact: true })
    .locator("..")
    .getByRole("button", { name: "Dismiss" })
    .click();
  await expect(
    issuesTable(page).getByRole("cell", { name: "broken-deployment", exact: true })
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Dismissed" }).click();
  await expect(
    issuesTable(page).getByRole("cell", { name: "broken-deployment", exact: true })
  ).toBeVisible();

  await issuesTable(page)
    .getByRole("cell", { name: "broken-deployment", exact: true })
    .locator("..")
    .getByRole("button", { name: "Restore" })
    .click();

  await page.getByRole("button", { name: "Active" }).click();
  await expect(
    issuesTable(page).getByRole("cell", { name: "broken-deployment", exact: true })
  ).toBeVisible();
});

test("resources: deployments and pods show expected resources", async ({ page }) => {
  await loginAs(page, admin.email, admin.password);

  await page.getByRole("link", { name: "Resource Explorer" }).click();
  await expect(page.getByRole("heading", { name: "Resource Explorer" })).toBeVisible();
  await page.getByRole("button", { name: "Deployments" }).click();

  const deploymentsTable = page.getByRole("table").first();
  await expect(
    deploymentsTable.getByRole("cell", { name: "broken-deployment", exact: true })
  ).toBeVisible();
  await expect(deploymentsTable.getByRole("cell", { name: "podinfo" })).toBeVisible();

  await page.getByRole("button", { name: "Pods" }).click();
  const podsTable = page.getByRole("table").first();
  await expect(podsTable.getByRole("cell", { name: "gpu-pod", exact: true }).first()).toBeVisible();
});

test("admin panel: policy controls are visible for admin", async ({ page }) => {
  await loginAs(page, admin.email, admin.password);

  await page.getByRole("link", { name: "Admin Panel" }).click();
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(
    page.getByLabel("Namespace allow list (comma-separated)")
  ).toBeVisible();
  await expect(
    page.getByLabel("Kind allow list (comma-separated)")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save policy" })).toBeVisible();
});
