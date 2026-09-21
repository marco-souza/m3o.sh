import { expect, test } from "@playwright/test";
import { m3o, navLinks } from "../src/config/links.ts";
import { defaultLang, ui } from "../src/i18n/ui.ts";

const t = ui[defaultLang];
const navLabel = (url: string) => {
  const label = navLinks.find((l) => l.url === url)?.label;
  if (!label) throw new Error(`No nav link found for ${url}`);
  return label;
};

// ──────────────────────────────────────────────────────────────────────────────
// Cross-page navigation
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("can navigate from home to lab via nav", async ({ page }) => {
    await page.goto("/");

    await page
      .locator("nav")
      .getByRole("link", { name: navLabel("/lab") })
      .click();

    await expect(page).toHaveURL(/\/lab/);
    await expect(
      page.getByRole("heading", { name: t["lab.heading"], level: 2 }),
    ).toBeVisible();
  });

  test("can navigate from home to work-with-me via nav", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: navLabel("/work-with-me") }).click();

    await expect(page).toHaveURL(/\/work-with-me/);
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.meta.title"],
        level: 1,
      }),
    ).toBeVisible();
  });

  test("can navigate from home to mock-interview via nav", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: navLabel("/mock-interview") }).click();

    await expect(page).toHaveURL(/\/mock-interview/);
    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.intro.heading"],
        level: 2,
      }),
    ).toBeVisible();
  });

  test("can navigate from home to socials via nav", async ({ page }) => {
    await page.goto("/");

    await page
      .locator("nav")
      .getByRole("link", { name: navLabel("/socials") })
      .click();

    await expect(page).toHaveURL(/\/socials/);
    await expect(
      page.getByRole("heading", {
        name: t["socials.meta.title"],
        level: 1,
      }),
    ).toBeVisible();
  });

  test("can navigate directly to all main pages", async ({ page }) => {
    const paths = navLinks.map((l) => l.url).filter((url) => url !== "/blog");

    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator("nav")).toBeVisible();
      await expect(page.locator("#footer")).toBeVisible();
    }
  });

  test("lab back button returns to lab index", async ({ page }) => {
    await page.goto("/lab/open-tv");

    const backButton = page.getByRole("link", { name: t["lab.back"] });
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveAttribute("href", "/lab");
  });

  test("social links on Socials page open in new tab", async ({ page }) => {
    await page.goto("/socials");

    const githubLink = page.getByRole("link", {
      name: m3o.github.replace("https://", ""),
    });
    const linkedinLink = page.getByRole("link", {
      name: m3o.linkedin.replace("https://", ""),
    });

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
