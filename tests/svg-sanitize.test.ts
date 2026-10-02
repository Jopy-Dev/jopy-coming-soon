import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeSvg, sanitizeIconSvg, sanitizeLogoSvg, UnsafeSvgError } from "../vite-plugins/svg-sanitize";

const icon = (name: string): string => readFileSync(resolve(import.meta.dirname, "../assets/icons", name), "utf8");

describe("REQ-006 icon sanitizer", () => {
  it.each(["linkedin.svg", "github.svg", "contact.svg"])("rebuilds %s with currentColor, aria-hidden, no size/title", (name) => {
    const out = sanitizeIconSvg(icon(name), name);
    expect(out).toMatch(/^<svg viewBox="[^"]+" aria-hidden="true" focusable="false"><path fill="currentColor"/);
    expect(out).not.toMatch(/width=|height=|<title|#888888/);
  });

  it.each([
    ['<svg viewBox="0 0 1 1"><script>alert(1)</script><path d="M0 0"/></svg>', "script"],
    ['<svg viewBox="0 0 1 1" onload="x()"><path d="M0 0"/></svg>', "event handler"],
    ['<svg viewBox="0 0 1 1"><a href="https://x"><path d="M0 0"/></a></svg>', "link"],
    ['<svg viewBox="0 0 1 1"><g><path d="M0 0"/></g></svg>', "unlisted element"],
    ['<svg viewBox="0 0 1 1"><path d="M0 0 url(x)"/></svg>', "bad path data"],
    ['<svg><path d="M0 0"/></svg>', "missing viewBox"],
  ])("rejects %s (%s)", (svg) => {
    expect(() => sanitizeIconSvg(svg, "fixture")).toThrow(UnsafeSvgError);
  });
});

describe("REQ-006 sanitizer edge branches", () => {
  it("keeps valid fill-rule/clip-rule, drops invalid ones", () => {
    const out = sanitizeIconSvg('<svg viewBox="0 0 1 1"><path fill-rule="evenodd" clip-rule="bogus" d="M0 0"/></svg>', "f");
    expect(out).toContain('fill-rule="evenodd"');
    expect(out).not.toContain("clip-rule");
  });

  it.each([
    ['<path d="M0 0"/>', "missing svg root"],
    ['<svg viewBox="0 0 1 1"><title>x</title></svg>', "no paths"],
    ['<svg viewBox="0 0 1 1"><path/></svg>', "path without d"],
    ['<svg viewBox="a b c d"><path d="M0 0"/></svg>', "invalid viewBox"],
  ])("rejects %s (%s)", (svg) => {
    expect(() => sanitizeIconSvg(svg, "fixture")).toThrow(UnsafeSvgError);
  });

  it("ignores XML prolog and comments", () => {
    const out = sanitizeIconSvg('<?xml version="1.0"?><!-- <script> --><svg viewBox="0 0 1 1"><path d="M0 0"/></svg>', "f");
    expect(out).toContain('d="M0 0"');
  });
});

describe("REQ-022 favicon safety check", () => {
  it("accepts the supplied logo unmodified", () => {
    expect(() => assertSafeSvg(icon("Logo.svg"), "Logo.svg")).not.toThrow();
  });
});

describe("REQ-022/REQ-023 logo sanitizer", () => {
  it("rebuilds Logo.svg keeping its hex fills, aria-hidden, no size or stroke", () => {
    const out = sanitizeLogoSvg(icon("Logo.svg"), "Logo.svg");
    expect(out).toMatch(/^<svg viewBox="0 0 1095 1095" aria-hidden="true" focusable="false"><path fill="#03955C"/);
    expect(out).toContain('fill="#07738B"');
    expect(out).not.toMatch(/width=|height=|stroke|currentColor/);
  });
});

describe("REQ-022/REQ-023 logo sanitizer fill allowlist", () => {
  it.each([
    ['<svg viewBox="0 0 1 1"><path fill="red" d="M0 0"/></svg>', "named color"],
    ['<svg viewBox="0 0 1 1"><path fill="#12345" d="M0 0"/></svg>', "5-digit hex"],
    ['<svg viewBox="0 0 1 1"><path fill="#fff" x="" d="M0 0"/><path d="M1 1"/></svg>', "missing fill"],
    ['<svg viewBox="0 0 1 1"><path fill="#ffffff;stroke:red" d="M0 0"/></svg>', "trailing payload"],
  ])("rejects %s (%s)", (svg) => {
    expect(() => sanitizeLogoSvg(svg, "fixture")).toThrow(UnsafeSvgError);
  });

  it("accepts 3-digit hex", () => {
    expect(sanitizeLogoSvg('<svg viewBox="0 0 1 1"><path fill="#0a0" d="M0 0"/></svg>', "f")).toContain('fill="#0a0"');
  });
});
