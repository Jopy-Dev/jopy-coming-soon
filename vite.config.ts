/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import { analyticsBeacon } from "./vite-plugins/analytics-beacon.ts";
import { favicon } from "./vite-plugins/favicon.ts";
import { fontPreload } from "./vite-plugins/font-preload.ts";
import { inlineIcons } from "./vite-plugins/inline-icons.ts";

const root = import.meta.dirname;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  return {
    plugins: [
      inlineIcons(resolve(root, "assets/icons")),
      favicon(resolve(root, "assets/icons/Logo.svg")),
      fontPreload(["geist-mono-latin-800-normal", "jetbrains-mono-latin-300-normal"]),
      analyticsBeacon(env.VITE_CF_BEACON_TOKEN),
    ],
    build: {
      target: "es2022",
      // Inline-asset threshold 0: every asset is a file, so CSP needs no data: fonts/images.
      assetsInlineLimit: 0,
      rolldownOptions: {
        input: {
          main: resolve(root, "index.html"),
          notFound: resolve(root, "404.html"),
        },
      },
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts", "vite-plugins/svg-sanitize.ts"],
        // main.ts only wires effects to the DOM; covered by e2e (tests/e2e).
        exclude: ["src/main.ts"],
        reportsDirectory: ".qa/coverage",
        thresholds: {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95,
          // Security-critical: build-time SVG sanitizer (REQ-006, REQ-900).
          "vite-plugins/svg-sanitize.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        },
      },
    },
  };
});
