import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export interface ExpectedFailure {
  readonly urlPattern: RegExp;
  readonly status: number;
  readonly reason: string;
}

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly httpErrors: string[];
  /** Declare an allowed failing response for this test (expected-failure allowlist). */
  allow(expected: ExpectedFailure): void;
}

/**
 * Browser failure gate: every test auto-fails on console errors (incl. CSP violations),
 * unhandled exceptions, failed requests, or 4xx/5xx responses outside its declared allowlist.
 */
export const test = base.extend<{ failures: BrowserFailures }>({
  failures: [
    async ({ page }, use) => {
      const allowed: ExpectedFailure[] = [];
      const isAllowed = (url: string, status: number) => allowed.some((a) => a.urlPattern.test(url) && a.status === status);
      const failures: BrowserFailures = {
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
        httpErrors: [],
        allow: (expected) => allowed.push(expected),
      };
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        // Chromium logs the expected 404 document load as a console error; covered by the allowlist instead.
        const loc = msg.location().url;
        if (/status of 404/.test(msg.text()) && isAllowed(loc, 404)) return;
        failures.consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => failures.pageErrors.push(err.message));
      page.on("requestfailed", (req) => failures.failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText ?? ""}`));
      page.on("response", (res) => {
        if (res.status() >= 400 && !isAllowed(res.url(), res.status())) failures.httpErrors.push(`${res.status()} ${res.url()}`);
      });
      await use(failures);
      expect(failures.consoleErrors, "unexpected console errors").toEqual([]);
      expect(failures.pageErrors, "unhandled exceptions").toEqual([]);
      expect(failures.failedRequests, "failed requests").toEqual([]);
      expect(failures.httpErrors, "unexpected HTTP errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** WCAG 2.2 AA scan; fails on serious/critical (REQ-902). */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
