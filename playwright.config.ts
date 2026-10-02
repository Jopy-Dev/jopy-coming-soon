import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;

// E2E runs against `wrangler pages dev dist`, which applies public/_headers and
// Pages 404 semantics, so header/CSP/404 assertions match production (REQ-017, REQ-900).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Bounded parallelism: every page runs a continuous canvas + timers. Default (cores / 2) launched
  // 16 browsers on a 32-thread dev machine and crashed pages under memory pressure.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: ".qa/playwright-report" }]] : "list",
  outputDir: ".qa/playwright-results",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  // Chromium runs the full suite; Firefox + WebKit run @critical journeys.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@critical/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@critical/ },
  ],
  webServer: {
    command: `npx wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} --compatibility-date 2026-09-01`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
