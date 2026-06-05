import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Lab page
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Lab page", () => {
  test("has correct title and heading", async ({ page }) => {
    await page.goto("/lab");

    await expect(page).toHaveTitle(/Marco's Lab/i);
    await expect(
      page.getByRole("heading", { name: "Lab", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText(/experiments on the bench/)).toBeVisible();
  });

  test("renders project cards", async ({ page }) => {
    await page.goto("/lab");

    // At least one project card should be visible
    const cards = page.locator(".card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test("featured project card spans full width", async ({ page }) => {
    await page.goto("/lab");

    const featuredCard = page.locator(".card.col-span-2");
    await expect(featuredCard).toBeVisible();
    await expect(featuredCard.getByText("Open TV")).toBeVisible();
  });

  test("tag badges link to filtered views", async ({ page }) => {
    await page.goto("/lab");

    const firstTag = page.locator(".badge").first();
    await expect(firstTag).toBeVisible();

    const href = await firstTag.getAttribute("href");
    expect(href).toMatch(/\/lab\?tag=/);
  });

  test("filtering by tag updates counter text", async ({ page }) => {
    await page.goto("/lab?tag=tv");

    await expect(page.getByText(/experiments tagged with tv/)).toBeVisible();
  });

  test("clear filter link returns to unfiltered lab", async ({ page }) => {
    await page.goto("/lab?tag=tv");

    const clearLink = page.getByRole("link", { name: /Clear filter/i });
    await expect(clearLink).toHaveAttribute("href", "/lab");
  });

  test("can navigate to Open TV project page", async ({ page }) => {
    await page.goto("/lab");

    await page.getByRole("link", { name: "Open TV" }).first().click();
    await expect(page).toHaveURL(/\/lab\/open-tv/);
    await expect(page.getByRole("heading", { name: "Open TV" })).toBeVisible();
  });

  test("renders WIP banner for work-in-progress projects", async ({ page }) => {
    await page.goto("/lab/open-tv");

    const banner = page.locator("text=This project is a work in progress");
    await expect(banner.first()).toBeVisible();
  });
});
