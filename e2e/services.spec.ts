import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Work with Me page
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Work with Me page", () => {
  test("has correct title and hero", async ({ page }) => {
    await page.goto("/work-with-me");

    await expect(page).toHaveTitle(/Work with Me/i);
    await expect(
      page.getByRole("heading", { name: "Work with Me", level: 1 }),
    ).toBeVisible();
  });

  test("renders full-time roles section with CTAs", async ({ page }) => {
    await page.goto("/work-with-me");

    await expect(
      page.getByRole("heading", { name: "Full-Time Roles", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "View Resume" })).toBeVisible();
    await expect(
      page.locator("#fte").getByRole("link", { name: "View LinkedIn" }),
    ).toHaveAttribute("href", "https://linkedin.com/in/masouzajunior");
  });

  test("renders consulting services grid", async ({ page }) => {
    await page.goto("/work-with-me");

    await expect(
      page.getByRole("heading", { name: "Consulting", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Interim CTO" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Architecture Review" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Team Coaching" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "1:1 Advisory" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mock Interview" }),
    ).toBeVisible();
  });

  test("has booking CTA with mailto link", async ({ page }) => {
    await page.goto("/work-with-me");

    const bookButton = page.getByRole("link", { name: "Book a Call" }).first();
    await expect(bookButton).toBeVisible();
    await expect(bookButton).toHaveAttribute("href", /mailto:.*Consulting/);
  });

  test("renders contact section with email, LinkedIn, and GitHub", async ({
    page,
  }) => {
    await page.goto("/work-with-me");

    await expect(
      page.getByRole("heading", { name: "Contact", level: 2 }),
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

    await expect(page).toHaveTitle(/Marco Souza/i);
    await expect(
      page.getByRole("heading", { name: "Mock Interview", level: 2 }),
    ).toBeVisible();
  });

  test("renders interview type cards", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(
      page.getByRole("heading", { name: "What We Cover", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coding" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "System Design" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Behavioral" }),
    ).toBeVisible();
  });

  test("renders process steps", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(
      page.getByRole("heading", { name: "How It Works", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Book a 60-minute session")).toBeVisible();
    await expect(
      page.getByText("Run a realistic interview simulation"),
    ).toBeVisible();
    await expect(
      page.getByText("Receive detailed feedback + an action plan"),
    ).toBeVisible();
  });

  test("renders pricing and PodCodar note", async ({ page }) => {
    await page.goto("/mock-interview");

    await expect(
      page.getByRole("heading", { name: "Pricing", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("$150 per 60-minute session")).toBeVisible();
    await expect(
      page.getByText(/PodCodar students receive a special discount/),
    ).toBeVisible();
  });

  test("has booking CTA with mailto link", async ({ page }) => {
    await page.goto("/mock-interview");

    const bookButton = page.getByRole("link", { name: "Book a Session" });
    await expect(bookButton).toBeVisible();
    await expect(bookButton).toHaveAttribute(
      "href",
      /mailto:.*Mock%20Interview/,
    );
  });
});
