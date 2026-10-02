import { expect, expectNoSeriousA11yViolations, gotoRevealed, test } from "./helpers";
import { routeFor, VIEWPORTS } from "./route-manifest";

const home = routeFor("SCREEN-001");

test.describe("SCREEN-001 Coming Soon hero", () => {
  test("@critical serves 200 with security headers, CSP, no cookies (REQ-900, REQ-903)", async ({ request, page }) => {
    const res = await request.get(home.path);
    expect(res.status()).toBe(home.expectedStatus);
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'none'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=31536000");
    expect(h["set-cookie"]).toBeUndefined();
    await gotoRevealed(page, home.path);
    expect(await page.context().cookies()).toEqual([]);
  });

  test("@critical renders content, metadata, one h1, no countdown, social nav only (REQ-001..003, REQ-019)", async ({ page }) => {
    await gotoRevealed(page, home.path);
    await expect(page).toHaveTitle("Jopy — Coming Soon");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://jopy.dev/");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "The technology partner built for what's next. Launching soon at jopy.dev.");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Jopy — Coming Soon");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("The technology partner built for what’s next.");
    await expect(page.locator(".display")).toHaveText("Coming Soon");
    await expect(page.locator(".tagline")).toContainText("reshaping how your business operates");
    await expect(page.locator("nav")).toHaveCount(1);
    await expect(page.locator("nav")).toHaveAttribute("aria-label", "Social links");
    await expect(page.locator("time, [data-countdown]")).toHaveCount(0);
    await page.waitForTimeout(1500);
  });

  test("@critical outbound links: targets, new tab, rel isolation, labels, icons (REQ-004, REQ-006, REQ-007)", async ({ page }) => {
    await gotoRevealed(page, home.path);
    const pill = page.locator(".pill");
    await expect(pill).toHaveAttribute("href", "https://portfolio.jopy.dev");
    await expect(pill).toHaveAttribute("target", "_blank");
    await expect(pill).toHaveAttribute("rel", "noopener");
    await expect(page.locator(".pill__dot")).toBeVisible();

    const rail = page.locator(".rail a");
    await expect(rail).toHaveCount(3);
    const expected = [
      ["https://www.linkedin.com/in/markjommer", "noopener noreferrer", "LinkedIn (opens in new tab)"],
      ["https://github.com/Jopy-Dev", "noopener noreferrer", "GitHub (opens in new tab)"],
      ["https://portfolio.jopy.dev/#contact", "noopener", "Contact (opens in new tab)"],
    ] as const;
    for (const [i, [href, rel, label]] of expected.entries()) {
      const link = rail.nth(i);
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", rel);
      await expect(link).toHaveAttribute("aria-label", label);
      await expect(link.locator('svg[aria-hidden="true"] path[fill="currentColor"]')).toHaveCount(1);
    }
  });

  for (const vp of VIEWPORTS) {
    test(`exact center, no overflow, touch targets, rail clear at ${vp.name} (REQ-009, REQ-021, REQ-905, REQ-902)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoRevealed(page, home.path);
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const c = document.querySelector(".hero-copy")!.getBoundingClientRect();
        const rail = document.querySelector(".rail")!.getBoundingClientRect();
        const pill = document.querySelector(".pill")!.getBoundingClientRect();
        const overlap = !(c.right <= rail.left || c.left >= rail.right || c.bottom <= rail.top || c.top >= rail.bottom);
        return {
          dx: Math.abs((c.left + c.right) / 2 - innerWidth / 2),
          dy: Math.abs((c.top + c.bottom) / 2 - innerHeight / 2),
          overflowX: document.documentElement.scrollWidth - innerWidth,
          overlap,
          railBottomRight: [innerWidth - rail.right, innerHeight - rail.bottom],
          pillHeight: pill.height,
          railSizes: [...document.querySelectorAll(".rail a")].map((a) => a.getBoundingClientRect().height),
          bodyFont: parseFloat(getComputedStyle(document.querySelector(".tagline")!).fontSize),
        };
      });
      expect(m.dx).toBeLessThanOrEqual(1);
      expect(m.dy).toBeLessThanOrEqual(1);
      expect(m.overflowX).toBeLessThanOrEqual(0);
      expect(m.overlap).toBe(false);
      expect(m.railBottomRight.every((gap) => gap >= 16 && gap <= 24)).toBe(true);
      expect(m.pillHeight).toBeGreaterThanOrEqual(44);
      for (const size of m.railSizes) expect(size).toBeGreaterThanOrEqual(44);
      expect(m.bodyFont).toBeGreaterThanOrEqual(16);
      await page.screenshot({ path: `.qa/parity-audit/wave-01/home-${vp.name}.png` });
    });
  }

  test("rail expands leftward on hover and keyboard focus, right edge anchored (REQ-008)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoRevealed(page, home.path);
    const github = page.locator(".rail a").nth(1);
    const before = await github.boundingBox();
    await github.hover();
    await page.waitForTimeout(500);
    const hovered = await github.boundingBox();
    expect(hovered!.width).toBeGreaterThan(before!.width + 20);
    expect(Math.abs(hovered!.x + hovered!.width - (before!.x + before!.width))).toBeLessThanOrEqual(1);
    await page.mouse.move(10, 10);
    await page.keyboard.press("Tab"); // Portfolio
    await page.keyboard.press("Tab"); // LinkedIn
    await page.keyboard.press("Tab"); // GitHub
    await expect(github).toBeFocused();
    await page.waitForTimeout(500);
    expect((await github.boundingBox())!.width).toBeGreaterThan(before!.width + 20);
  });

  test("portfolio flair grows from pointer on hover (REQ-005)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoRevealed(page, home.path);
    await expect(page.locator("html")).toHaveClass(/has-flair/);
    await page.locator(".pill").hover();
    await page.waitForTimeout(600);
    expect(await page.locator(".flair").evaluate((el) => getComputedStyle(el).scale)).toBe("1");
    await expect(page.locator(".pill")).toHaveCSS("color", "rgb(23, 23, 23)");
  });

  test("click on empty area ripples the dot field, clicks on links do not (REQ-010, REQ-011)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoRevealed(page, home.path);
    const alpha = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>(".dot-field")!;
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let sum = 0;
        for (let i = 3; i < d.length; i += 4) sum += d[i]!;
        return sum;
      });
    const idle = await alpha();
    expect(idle).toBeGreaterThan(0);
    await page.mouse.click(200, 400);
    await page.waitForTimeout(400);
    expect(await alpha()).toBeGreaterThan(idle);
    await page.waitForTimeout(2600);
    expect(await alpha()).toBe(idle);
  });

  test("desktop cards stay within 1..8 and never cover the text block (REQ-012, REQ-014)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoRevealed(page, home.path);
    await page.waitForTimeout(5000);
    const r = await page.evaluate(() => {
      const copy = document.querySelector(".hero-copy")!.getBoundingClientRect();
      const cards = [...document.querySelectorAll(".card.is-visible")].map((c) => c.getBoundingClientRect());
      const hit = cards.some((c) => !(c.right <= copy.left || c.left >= copy.right || c.bottom <= copy.top || c.top >= copy.bottom));
      return { count: cards.length, hit, swarmHidden: document.querySelector(".swarm")!.getAttribute("aria-hidden") };
    });
    expect(r.count).toBeGreaterThanOrEqual(1);
    expect(r.count).toBeLessThanOrEqual(8);
    expect(r.hit).toBe(false);
    expect(r.swarmHidden).toBe("true");
  });

  test("phone shows at most 4 cards, none clipped (REQ-013)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoRevealed(page, home.path);
    await page.waitForTimeout(5000);
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".card.is-visible")].map((c) => c.getBoundingClientRect());
      return { count: cards.length, clipped: cards.some((c) => c.left < 0 || c.right > innerWidth) };
    });
    expect(r.count).toBeLessThanOrEqual(4);
    expect(r.clipped).toBe(false);
  });

  test("@critical passes axe WCAG 2.2 AA (REQ-902)", async ({ page }) => {
    await gotoRevealed(page, home.path);
    await expectNoSeriousA11yViolations(page);
  });

  test("favicons, robots, security.txt served (REQ-022, REQ-900)", async ({ request }) => {
    for (const path of ["/favicon.svg", "/favicon.ico", "/apple-touch-icon.png", "/robots.txt", "/.well-known/security.txt"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    expect(await (await request.get("/.well-known/security.txt")).text()).toContain("Contact: https://portfolio.jopy.dev/#contact");
  });
});

test.describe("SCREEN-001 fallbacks", () => {
  test.use({ javaScriptEnabled: false });
  test("@critical works without JavaScript (REQ-016)", async ({ page }) => {
    await page.goto(home.path);
    await expect(page.locator(".loader"), "no loading screen without JS (REQ-023)").toBeHidden({ timeout: 100 });
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".tagline")).toBeVisible();
    await expect(page.locator(".pill")).toBeVisible();
    await expect(page.locator(".rail a")).toHaveCount(3);
    await expect(page.locator("html")).toHaveClass(/no-js/);
  });
});

test.describe("SCREEN-001 reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no scramble, no ripple, no flair, no loading screen (REQ-015, REQ-023)", async ({ page }) => {
    await page.goto(home.path);
    await expect(page.locator(".loader")).toBeHidden({ timeout: 100 });
    await expect(page.locator("main")).not.toHaveAttribute("inert");
    await page.waitForTimeout(2500);
    const mismatches = await page.evaluate(() =>
      [...document.querySelectorAll(".card")].filter((c) => c.querySelector(".card__live")?.textContent !== c.querySelector(".card__final")?.textContent).length,
    );
    expect(mismatches).toBe(0);
    await expect(page.locator(".flair")).toHaveCount(0);
  });
});
