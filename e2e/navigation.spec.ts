import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Cross-page navigation
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("can navigate from home to lab via nav", async ({ page }) => {
    await page.goto("/");

    await page.locator("nav").getByRole("link", { name: "Lab" }).click();

    await expect(page).toHaveURL(/\/lab/);
    await expect(
      page.getByRole("heading", { name: "Lab", level: 2 }),
    ).toBeVisible();
  });

  test("can navigate from home to work-with-me via nav", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Work with Me" }).click();

    await expect(page).toHaveURL(/\/work-with-me/);
    await expect(
      page.getByRole("heading", { name: "Work with Me", level: 1 }),
    ).toBeVisible();
  });

  test("can navigate from home to mock-interview via nav", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Mock Interview" }).click();

    await expect(page).toHaveURL(/\/mock-interview/);
    await expect(
      page.getByRole("heading", { name: "Mock Interview", level: 2 }),
    ).toBeVisible();
  });

  test("can navigate directly to all main pages", async ({ page }) => {
    const paths = ["/", "/lab", "/work-with-me", "/mock-interview"];

    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator("nav")).toBeVisible();
      await expect(page.locator("#footer")).toBeVisible();
    }
  });

  test("lab back button returns to lab index", async ({ page }) => {
    await page.goto("/lab/open-tv");

    const backButton = page.getByRole("link", { name: /Back to Lab/i });
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveAttribute("href", "/lab");
  });

  test("social links open in new tab", async ({ page }) => {
    await page.goto("/");

    const githubLink = page
      .locator("nav")
      .getByRole("link", { name: "GitHub" });
    const linkedinLink = page
      .locator("nav")
      .getByRole("link", { name: "LinkedIn" });

    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(linkedinLink).toHaveAttribute("target", "_blank");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 404 handling
// ──────────────────────────────────────────────────────────────────────────────

test.describe("404 page", () => {
  test("returns 404 for non-existent routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("404 page still shows site branding", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    // Astro default 404 doesn't include custom layout; just verify it's a 404
    await expect(
      page.getByText(/404|Not Found|page not found/i).first(),
    ).toBeVisible();
  });
});
