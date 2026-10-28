import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// Lab page
// ──────────────────────────────────────────────────────────────────────────────

test.describe("ATProto", () => {
  test("start with did", async ({ page }) => {
    await page.goto("/.well-known/atproto-did");

    const content = await page.waitForSelector("body");
    const text = await content.textContent();

    expect(text?.startsWith("did:plc:")).toBeTruthy();
  });
});
