import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Homepage
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Homepage", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Marco Souza/i);
  });

  test("renders hero section with name and subtitle", async ({ page }) => {
    await page.goto("/");

    const hero = page.locator("#hero");
    await expect(hero).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: /Marco Souza/i, level: 1 }),
    ).toBeVisible();
    await expect(hero.getByText(/Solutions Architect/i)).toBeVisible();
  });

  test("renders presentation section", async ({ page }) => {
    await page.goto("/");

    const presentation = page.locator("#presentation");
    await expect(presentation).toBeVisible();
    await expect(presentation.getByText(/Hi! I’m Marco/)).toBeVisible();
    await expect(presentation.getByText(/MongoDB/)).toBeVisible();
    await expect(presentation.getByText(/PodCodar/)).toBeVisible();
  });

  test("renders navigation with expected links", async ({ page }) => {
    await page.goto("/");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Lab" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "GitHub" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "LinkedIn" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Mock Interview" }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "Work with Me" })).toBeVisible();
  });

  test("renders footer with copyright and OSS link", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator("#footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/Marco Souza/)).toBeVisible();
    await expect(
      footer.getByRole("link", { name: /Open Source/i }),
    ).toHaveAttribute("href", "https://github.com/marco-souza/m3o.sh");
  });

  test("can scroll to footer", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#hero")).toBeVisible();

    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    );

    await expect(page.locator("#footer")).toBeInViewport();
  });
});
