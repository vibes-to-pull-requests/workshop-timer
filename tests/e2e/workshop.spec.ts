import { expect, test } from "@playwright/test";

test("facilitates two segments through warnings, pause, overtime, and summary", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-01T08:00:00Z") });
  await page.goto("./");

  await page.getByRole("button", { name: "Add segment" }).click();
  await page.getByLabel("Segment name").fill("Welcome");
  await page.getByLabel("Duration in minutes").fill("1");
  await page.getByRole("button", { name: "Add segment" }).click();
  await page.getByLabel("Segment name").nth(1).fill("Lesson");
  await page.getByLabel("Duration in minutes").nth(1).fill("1");
  await page.getByRole("button", { name: "Start workshop" }).click();

  await page.clock.runFor(45_000);
  await expect(page.getByText("25% remaining")).toBeVisible();
  await expect(page.getByTestId("timer-value")).toHaveText("00:15");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId("timer-value")).toHaveText("00:15");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Next segment" }).click();
  await expect(page.getByRole("heading", { name: "Lesson" })).toBeFocused();

  await page.clock.runFor(61_000);
  await expect(page.getByText("Overtime", { exact: true })).toBeVisible();
  await expect(page.getByTestId("timer-value")).toHaveText("+00:01");
  await page.getByRole("button", { name: "Finish workshop" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish workshop" }).click();

  await expect(page.getByRole("heading", { name: "How the time was used" })).toBeVisible();
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText("Welcome");
  await expect(rows.nth(1)).toContainText("00:15 under plan");
  await expect(rows.nth(2)).toContainText("Lesson");
  await expect(rows.nth(2)).toContainText("00:01 overtime");
});
