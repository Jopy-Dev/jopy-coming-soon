import { expect, expectNoSeriousA11yViolations, test } from "./helpers";
import { routeFor } from "./route-manifest";

const notFound = routeFor("SCREEN-002");
const EXPECTED_404 = { urlPattern: /\/this-page-does-not-exist$/, status: 404, reason: "SCREEN-002 must return 404 (REQ-017)" };

test.describe("SCREEN-002 Not Found", () => {
  test("unknown path returns 404 with branded noindex page (REQ-017)", async ({ page, failures }) => {
    failures.allow(EXPECTED_404);
    const res = await page.goto(notFound.path);
    expect(res?.status()).toBe(notFound.expectedStatus);
    await expect(page.locator("h1")).toHaveText("This page doesn’t exist yet.");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.locator("a.home-link")).toHaveAttribute("href", "/");
  });

  test("passes axe WCAG 2.2 AA (REQ-902)", async ({ page, failures }) => {
    failures.allow(EXPECTED_404);
    await page.goto(notFound.path);
    await expectNoSeriousA11yViolations(page);
  });
});
