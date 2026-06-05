import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Open TV page — IPTV player
//
// NOTE: The channel list in the browser overlay comes from Astro SSR
// (getLiveCollection at build time), NOT from client-side fetch.
// The /api/channels mock below only affects the "refresh" action.
// ──────────────────────────────────────────────────────────────────────────────

/** Wait for the Astro SolidJS island to finish hydration. */
async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[client="load"]');
    return !island?.hasAttribute("ssr");
  });
}

test.describe("Open TV page", () => {
  test("loads page with title and wip banner", async ({ page }) => {
    await page.goto("/lab/open-tv");

    await expect(page).toHaveTitle(/Open TV/i);
    await expect(page.getByText(/work in progress/i)).toBeVisible();
  });

  test("player hydrates and shows browse button", async ({ page }) => {
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    const browseButton = page.getByRole("button", { name: "Browse Channels" });
    await expect(browseButton).toBeVisible();
  });

  test("clicking browse opens channel browser overlay", async ({ page }) => {
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });

    // Overlay header
    const dialog = page.getByRole("dialog", { name: "Channel browser" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Channels", exact: true }),
    ).toBeVisible();

    // At least one channel card is rendered
    const cards = page.locator('[role="option"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test("selecting a channel updates the URL query param", async ({ page }) => {
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });

    // Click the first channel card in the grid
    const firstCard = page.locator('[role="option"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // URL should gain a ?channel= param
    await expect(page).toHaveURL(/channel=/);
  });

  test("channel overlay shows info after selection", async ({ page }) => {
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });

    const firstCard = page.locator('[role="option"]').first();
    await expect(firstCard).toBeVisible();
    const ariaLabel = await firstCard.getAttribute("aria-label");
    await firstCard.click();

    // After selecting, the channel name should appear somewhere in the overlay
    // (either the channel info overlay or the browser heading)
    await expect(page.getByText(ariaLabel?.split(",")[0] ?? "")).toBeVisible();
  });

  test("close button dismisses browser overlay", async ({ page }) => {
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });
    await expect(
      page.getByRole("dialog", { name: "Channel browser" }),
    ).toBeVisible();

    // Close via the overlay header button (✕)
    await page
      .getByRole("dialog", { name: "Channel browser" })
      .getByRole("button", { name: "Close channel browser" })
      .click();

    // Overlay should be gone
    await expect(
      page.getByRole("dialog", { name: "Channel browser" }),
    ).toHaveCount(0);
  });

  test("shows error state on refresh when API returns 502", async ({
    page,
  }) => {
    await page.route("/api/channels", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Upstream unavailable" }),
      });
    });

    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    // Open browser and click refresh
    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });
    await page
      .getByRole("dialog", { name: "Channel browser" })
      .getByRole("button", { name: "Refresh channels" })
      .click();

    // Error message should appear
    await expect(
      page.getByText(/Upstream unavailable|502|Refresh failed/i),
    ).toBeVisible();
  });
});
