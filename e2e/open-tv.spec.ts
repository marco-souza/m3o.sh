import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Open TV page — generic M3U IPTV player.
//
// The channel list is no longer server-rendered. The SolidJS island loads
// channels from `localStorage` (`m3o-open-tv-channels-cache`) on hydration,
// and fetches them on demand via `POST /api/playlist` (Refresh / Settings).
//
// Tests seed the channel cache in `localStorage` before `page.goto` so a
// returning user renders straight from cache with zero network requests.
// The `POST /api/playlist` mock only affects the Refresh action + the 502
// error test.
// ──────────────────────────────────────────────────────────────────────────────

/** Default playlist URL (matches `DEFAULT_PLAYLIST_URL` in storage.ts). */
const DEFAULT_PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";

/** localStorage key for the parsed-channel cache blob. */
const CHANNELS_CACHE_KEY = "m3o-open-tv-channels-cache";

/** localStorage key for the user's saved playlist URL. */
const PLAYLIST_URL_KEY = "m3o-open-tv-playlist-url";

/** Minimal M3U `Channel` shape (`{ id, name, logo, url, categories }`). */
interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  categories: string[];
}

/** Two sample channels — enough to exercise browse + select flows. */
const SAMPLE_CHANNELS: Channel[] = [
  {
    id: "cnn-int",
    name: "CNN International",
    logo: "",
    url: "https://example.com/cnn-int.m3u8",
    categories: ["News"],
  },
  {
    id: "bbc-news",
    name: "BBC News",
    logo: "",
    url: "https://example.com/bbc-news.m3u8",
    categories: ["News"],
  },
];

/** Wait for the SolidJS island (client:only) to finish client rendering. */
async function waitForHydration(page: import("@playwright/test").Page) {
  // The island is client:only, so there is no SSR HTML to hydrate against —
  // we just wait for the app root to appear in the DOM.
  await page.waitForFunction(
    () => !!document.querySelector("astro-island .relative.h-full.w-full"),
  );
}

/**
 * Seed `m3o-open-tv-channels-cache` (and optionally the saved playlist URL)
 * in `localStorage` before the page loads, so the island renders straight
 * from cache as a returning user with zero network requests.
 */
async function seedChannelCache(
  page: import("@playwright/test").Page,
  opts: { savedUrl?: string } = {},
) {
  await page.addInitScript(
    ({ cacheKey, urlKey, url, channels, savedUrl }) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ url, channels, fetchedAt: Date.now() }),
        );
        if (savedUrl !== undefined) {
          localStorage.setItem(urlKey, savedUrl);
        }
      } catch {
        // localStorage unavailable — ignore
      }
    },
    {
      cacheKey: CHANNELS_CACHE_KEY,
      urlKey: PLAYLIST_URL_KEY,
      url: DEFAULT_PLAYLIST_URL,
      channels: SAMPLE_CHANNELS,
      savedUrl: opts.savedUrl,
    },
  );
}

test.describe("Open TV page", () => {
  test("loads page with title and wip banner", async ({ page }) => {
    await page.goto("/lab/open-tv");

    await expect(page).toHaveTitle(/Open TV/i);
    await expect(page.getByText(/work in progress/i)).toBeVisible();
  });

  test("player hydrates and shows browse button", async ({ page }) => {
    await seedChannelCache(page);
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    const browseButton = page.getByRole("button", { name: "Browse Channels" });
    await expect(browseButton).toBeVisible();
  });

  test("clicking browse opens channel browser overlay", async ({ page }) => {
    await seedChannelCache(page);
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

    // At least one channel card is rendered (from the seeded cache)
    const cards = page.locator('[role="option"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test("selecting a channel updates the URL query param", async ({ page }) => {
    await seedChannelCache(page);
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

  test("video element is visible after selecting a channel", async ({
    page,
  }) => {
    await seedChannelCache(page);
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    // Select a channel
    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });
    const firstCard = page.locator('[role="option"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Video element should be visible (not hidden by "invisible" class)
    const video = page.locator("video");
    await expect(video).toBeVisible();
    await expect(video).not.toHaveClass(/invisible/);
  });

  test("channel overlay shows info after selection", async ({ page }) => {
    await seedChannelCache(page);
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });

    const firstCard = page.locator('[role="option"]').first();
    await expect(firstCard).toBeVisible();
    const ariaLabel = await firstCard.getAttribute("aria-label");
    const channelName = ariaLabel?.split(",")[0] ?? "";
    await firstCard.click();

    // Browser dialog should close after selection
    await expect(
      page.getByRole("dialog", { name: "Channel browser" }),
    ).toHaveCount(0);

    // Channel name should appear in the non-aria-hidden overlay (not in dialog)
    // Look for the h2 with the channel name outside the dialog
    await expect(page.locator(`h2:text-is("${channelName}")`)).toBeVisible();
  });

  test("close button dismisses browser overlay", async ({ page }) => {
    await seedChannelCache(page);
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

  test("shows error state on refresh when playlist API returns 502", async ({
    page,
  }) => {
    // Seed a cached channel list so the player renders as a returning user
    // (view = "Ready"). The Refresh then fails against the mocked endpoint
    // but, because channels already exist, the browser overlay stays open and
    // surfaces the refresh error inline.
    await seedChannelCache(page);
    await page.goto("/lab/open-tv");
    await waitForHydration(page);

    // Mock POST /api/playlist -> 502 { error, kind: "fetch-failed" }
    await page.route("/api/playlist", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upstream unavailable",
          kind: "fetch-failed",
        }),
      });
    });

    // Open browser and click refresh
    await page
      .getByRole("button", { name: "Browse Channels" })
      .click({ force: true });
    await page
      .getByRole("dialog", { name: "Channel browser" })
      .getByRole("button", { name: "Refresh channels" })
      .click();

    // Error message should surface inside the ChannelBrowser error display
    await expect(
      page
        .getByRole("dialog", { name: "Channel browser" })
        .getByText(/Upstream unavailable|Refresh failed|fetch-failed/i),
    ).toBeVisible();
  });
});
