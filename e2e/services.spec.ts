import { expect, test } from "@playwright/test";
import { m3o } from "../src/config/links.ts";
import { defaultLang, ui } from "../src/i18n/ui.ts";

const t = ui[defaultLang];

// ──────────────────────────────────────────────────────────────────────────────
// Work with Me page
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Work with Me page", () => {
  test("has correct title and hero", async ({ page }) => {
    await page.goto("/work-with-me");

    await expect(page).toHaveTitle(
      new RegExp(t["work-with-me.meta.title"], "i"),
    );
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.meta.title"],
        level: 1,
      }),
    ).toBeVisible();
  });

  test("renders full-time roles section with CTAs", async ({ page }) => {
    await page.goto("/work-with-me");

    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.fte.heading"],
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: t["work-with-me.fte.cta.resume"] }),
    ).toBeVisible();
    await expect(
      page.locator("#fte").getByRole("link", {
        name: t["work-with-me.fte.cta.linkedin"],
      }),
    ).toHaveAttribute("href", m3o.linkedin);
  });

  test("renders consulting services grid", async ({ page }) => {
    await page.goto("/work-with-me");

    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.consulting.heading"],
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.consulting.services.interim-cto.title"],
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.consulting.services.architecture-review.title"],
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.consulting.services.team-coaching.title"],
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.consulting.services.advisory.title"],
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.consulting.services.mock-interview.title"],
      }),
    ).toBeVisible();
  });

  test("has booking CTA with mailto link", async ({ page }) => {
    await page.goto("/work-with-me");

    const bookButton = page
      .getByRole("link", { name: t["work-with-me.consulting.cta.book-call"] })
      .first();
    await expect(bookButton).toBeVisible();
    await expect(bookButton).toHaveAttribute("href", /mailto:.*Consulting/);
  });

  test("renders contact section with email, LinkedIn, and GitHub", async ({
    page,
  }) => {
    await page.goto("/work-with-me");

    await expect(
      page.getByRole("heading", {
        name: t["work-with-me.contact.heading"],
        level: 2,
      }),
    ).toBeVisible();

    const emailLink = page.locator('a[href^="mailto:"]').first();
    await expect(emailLink).toBeVisible();

    await expect(
      page.getByRole("link", { name: /linkedin.com/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /github.com/ })).toBeVisible();
  });

  test("mock interview card links to /mock-interview", async ({ page }) => {
    await page.goto("/work-with-me");

    const mockInterviewLink = page.locator('a[href="/mock-interview"]').first();
    await expect(mockInterviewLink).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Mock Interview page
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Mock Interview page", () => {
  test("has correct title and intro", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(page).toHaveTitle(
      new RegExp(t["mock-interview.meta.title"], "i"),
    );
    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.intro.heading"],
        level: 2,
      }),
    ).toBeVisible();
  });

  test("renders interview type cards", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.types.heading"],
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.types.coding.title"],
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.types.system-design.title"],
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.types.behavioral.title"],
      }),
    ).toBeVisible();
  });

  test("renders process steps", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.process.heading"],
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(t["mock-interview.process.step1"]),
    ).toBeVisible();
    await expect(
      page.getByText(t["mock-interview.process.step3"]),
    ).toBeVisible();
    await expect(
      page.getByText(t["mock-interview.process.step4"]),
    ).toBeVisible();
  });

  test("renders pricing and PodCodar note", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(
      page.getByRole("heading", {
        name: t["mock-interview.pricing.heading"],
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(t["mock-interview.pricing.text"]),
    ).toBeVisible();
    await expect(
      page.getByText(t["mock-interview.pricing.podcodar-note"]),
    ).toBeVisible();
  });

  test("has booking CTA with mailto link", async ({ page }) => {
    await page.goto("/mock-interview");

    const bookButton = page.getByRole("link", {
      name: t["mock-interview.cta.book"],
    });
    await expect(bookButton).toBeVisible();
    await expect(bookButton).toHaveAttribute(
      "href",
      /mailto:.*Mock%20Interview/,
    );
  });
});
