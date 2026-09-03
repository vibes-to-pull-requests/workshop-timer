import { expect, test } from "@playwright/test";

test("reload restores an active workshop paused without counting closed time", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-01T08:00:00Z") });
  await page.goto("./");
  await page.getByRole("button", { name: "Add segment" }).click();
  await page.getByLabel("Segment name").fill("Welcome");
  await page.getByLabel("Duration in minutes").fill("1");
  await page.getByRole("button", { name: "Start workshop" }).click();
  await page.clock.runFor(5_000);

  await page.reload();
  await expect(page).toHaveURL(/\/workshop-timer\/$/);
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await expect(page.getByTestId("timer-value")).toHaveText("00:55");
  await page.clock.runFor(300_000);
  await expect(page.getByTestId("timer-value")).toHaveText("00:55");
});

test("the built app refreshes at its repository base path", async ({ page }) => {
  await page.goto("/workshop-timer/");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plan my workshop" })).toBeVisible();
});
