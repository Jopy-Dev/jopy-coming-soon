import { describe, expect, it } from "vitest";
import type { HtmlTagDescriptor, IndexHtmlTransformHook } from "vite";
import { analyticsBeacon } from "../vite-plugins/analytics-beacon";

// Deliberately low-entropy placeholder (never a real beacon token; keeps gitleaks quiet).
const FIXTURE_TOKEN = "test_fixture_token";

const run = (token: string | undefined): HtmlTagDescriptor[] => {
  const hook = analyticsBeacon(token).transformIndexHtml as IndexHtmlTransformHook;
  return hook.call({} as never, "<html></html>", {} as never) as HtmlTagDescriptor[];
};

describe("REQ-020 / METRIC-001..002 analytics beacon emission point", () => {
  it("injects the Cloudflare beacon with the configured token", () => {
    const [tag] = run(FIXTURE_TOKEN);
    expect(tag?.tag).toBe("script");
    expect(tag?.attrs?.src).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(tag?.attrs?.["data-cf-beacon"]).toBe(JSON.stringify({ token: FIXTURE_TOKEN }));
    expect(tag?.attrs?.defer).toBe(true);
  });

  it("injects nothing when no token is set (local/preview builds)", () => {
    expect(run(undefined)).toEqual([]);
    expect(run("")).toEqual([]);
  });

  it("rejects malformed tokens (attribute injection guard)", () => {
    expect(() => analyticsBeacon('x" onload="alert(1)')).toThrow(/unexpected format/);
  });
});
