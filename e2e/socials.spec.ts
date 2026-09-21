import { expect, test } from "@playwright/test";
import { m3o, podcodar } from "../src/config/links.ts";
import { defaultLang, ui } from "../src/i18n/ui.ts";

const t = ui[defaultLang];

const socials = [
  { label: t["social.github"], url: m3o.github },
  { label: t["social.linkedin"], url: m3o.linkedin },
  { label: t["social.discord"], url: m3o.discord },
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Socials page
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Socials page", () => {
  test("has correct title and hero", async ({ page }) => {
    await page.goto("/socials");

    await expect(page).toHaveTitle(new RegExp(t["socials.meta.title"], "i"));
    await expect(
      page.getByRole("heading", { name: t["socials.meta.title"], level: 1 }),
    ).toBeVisible();
  });

  test("renders heading and intro", async ({ page }) => {
    await page.goto("/socials");

    await expect(
      page
        .locator("main")
        .getByRole("heading", { name: t["socials.heading"], level: 2 }),
    ).toBeVisible();
    await expect(page.getByText(t["socials.intro"])).toBeVisible();
  });

  test("renders social links with correct handles", async ({ page }) => {
    await page.goto("/socials");

    for (const { url } of socials) {
      const handle = url.replace("https://", "");
      const link = page.getByRole("link", { name: handle });

      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("target", "_blank");
    }
  });

  test("renders PodCodar note", async ({ page }) => {
    await page.goto("/socials");

    await expect(page.getByText(t["socials.note"])).toBeVisible();
  });

  test("renders PodCodar CTAs opening in new tab", async ({ page }) => {
    await page.goto("/socials");

    const visitPodcodar = page.getByRole("link", {
      name: t["socials.cta.page"],
    });
    const joinDiscord = page.getByRole("link", {
      name: t["socials.cta.discord"],
    });

    await expect(visitPodcodar).toBeVisible();
    await expect(visitPodcodar).toHaveAttribute("href", podcodar.page);
    await expect(visitPodcodar).toHaveAttribute("target", "_blank");

    await expect(joinDiscord).toBeVisible();
    await expect(joinDiscord).toHaveAttribute("href", podcodar.discord);
    await expect(joinDiscord).toHaveAttribute("target", "_blank");
  });
});
