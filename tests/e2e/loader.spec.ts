import type { Page } from "@playwright/test";
import { expect, gotoRevealed, REVEAL_TIMEOUT_MS, test } from "./helpers";
import { routeFor } from "./route-manifest";

const home = routeFor("SCREEN-001");

const focusable = (page: Page): Promise<boolean> =>
  page.locator(".pill").evaluate((el: HTMLElement) => {
    el.focus();
    return document.activeElement === el;
  });
const notFound = routeFor("SCREEN-002");

// Upper bound from sequence start (performance mark "jopy:loader-start"): worst case ≈ 3.63s + fade 0.6s = 4.23s,
// plus timer drift under load (WebKit measured 4.37s); cap is 5s.
const REVEAL_BUDGET_MS = 4500;

test.describe("SCREEN-001 loading screen (REQ-023)", () => {
  test("@critical shows loading... then welcome, locks hero, then reveals it within budget", async ({ page }) => {
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const loader = document.querySelector<HTMLElement>(".loader");
        if (loader?.hidden && !performance.getEntriesByName("test:loader-hidden").length) performance.mark("test:loader-hidden");
        const text = document.querySelector(".loader__text-live")?.textContent ?? "";
        const seen = ((window as unknown as { __loaderTexts?: string[] }).__loaderTexts ??= []);
        if (text && seen.at(-1) !== text) seen.push(text);
      }).observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
    });
    await page.goto(home.path, { waitUntil: "commit" });
    const loader = page.locator(".loader");
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute("role", "status");
    await expect(page.locator("main")).toHaveAttribute("inert", "");
    expect(await focusable(page), "hero chrome not focusable behind the loading screen").toBe(false);

    await expect(loader).toBeHidden({ timeout: REVEAL_TIMEOUT_MS });
    // Resolved texts recorded from first paint: polling would race the 400ms "loading..." hold.
    const texts = await page.evaluate(() => (window as unknown as { __loaderTexts?: string[] }).__loaderTexts ?? []);
    const resolved = texts.filter((t) => t === "loading..." || t === "welcome");
    expect(resolved).toEqual(["loading...", "welcome"]);
    const revealMs = await page.evaluate(() => {
      const [start] = performance.getEntriesByName("jopy:loader-start");
      const [hidden] = performance.getEntriesByName("test:loader-hidden");
      return (hidden?.startTime ?? Infinity) - (start?.startTime ?? 0);
    });
    expect(revealMs).toBeLessThanOrEqual(REVEAL_BUDGET_MS);
    await expect(page.locator("main")).not.toHaveAttribute("inert");
    await expect(page.locator("html")).not.toHaveClass(/is-loading/);

    // Programmatic focus: WebKit Tab skips links by default (Safari setting), so keyboard Tab is not portable.
    expect(await focusable(page), "hero chrome focusable after reveal").toBe(true);
  });

  test("logo renders inline with its brand colors, decorative to assistive tech", async ({ page }) => {
    await page.goto(home.path);
    const logo = page.locator(".loader__logo svg");
    await expect(logo).toHaveAttribute("aria-hidden", "true");
    await expect(logo.locator('path[fill="#03955C"]')).toHaveCount(1);
    await expect(logo.locator('path[fill="#07738B"]')).toHaveCount(1);
  });

  test("cards start only after reveal", async ({ page }) => {
    await page.goto(home.path);
    await page.waitForTimeout(1500);
    await expect(page.locator(".card")).toHaveCount(0);
    await gotoRevealed(page, home.path);
    await expect(page.locator(".card").first()).toBeVisible({ timeout: 3000 });
  });

  test("404 page never shows the loading screen", async ({ page, failures }) => {
    failures.allow({ urlPattern: /this-page-does-not-exist/, status: 404, reason: "SCREEN-002 returns 404 by design" });
    await page.goto(notFound.path);
    await expect(page.locator(".loader")).toHaveCount(0);
  });
});
