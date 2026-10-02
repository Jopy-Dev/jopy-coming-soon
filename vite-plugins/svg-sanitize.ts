// Build-time SVG allowlist (REQ-006, REQ-022). Never forwards source markup:
// rebuilds a fresh <svg> from validated viewBox + path geometry only.

const ALLOWED_ELEMENTS = new Set(["svg", "path", "title"]);
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]+$/;
const VIEWBOX = /^\s*-?[\d.]+(\s+-?[\d.]+){3}\s*$/;
const FILL_RULE = /^(nonzero|evenodd)$/;
const HEX_FILL = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
const DANGEROUS = /(<script|\son\w+\s*=|href\s*=|<foreignObject|<image|<style|url\(|javascript:)/i;

export class UnsafeSvgError extends Error {
  constructor(source: string, reason: string) {
    super(`Unsafe SVG "${source}": ${reason}`);
    this.name = "UnsafeSvgError";
  }
}

function stripNonElements(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
}

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match?.[1];
}

/** Rejects anything outside svg/path/title or carrying script/link vectors. */
export function assertSafeSvg(svg: string, source: string): void {
  const body = stripNonElements(svg);
  if (DANGEROUS.test(body)) throw new UnsafeSvgError(source, "contains script, event handler, link, or embedded content");
  for (const match of body.matchAll(/<\s*([a-zA-Z][\w:-]*)/g)) {
    /* v8 ignore next -- capture group always matches; fallback only satisfies noUncheckedIndexedAccess */
    const name = match[1] ?? "";
    if (!ALLOWED_ELEMENTS.has(name)) throw new UnsafeSvgError(source, `element <${name}> not allowed`);
  }
}

function ruleAttr(tag: string, name: string): string {
  const value = attr(tag, name);
  return value && FILL_RULE.test(value) ? ` ${name}="${value}"` : "";
}

type FillOf = (tag: string) => string;

/** Rebuilds one <path> from validated geometry and a caller-validated fill only. */
function sanitizePath(tag: string, source: string, fillOf: FillOf): string {
  const d = attr(tag, "d");
  if (!d || !PATH_DATA.test(d)) throw new UnsafeSvgError(source, "path data missing or invalid");
  return `<path fill="${fillOf(tag)}"${ruleAttr(tag, "fill-rule")}${ruleAttr(tag, "clip-rule")} d="${d.trim()}"/>`;
}

function rebuildSvg(svg: string, source: string, fillOf: FillOf): string {
  assertSafeSvg(svg, source);
  const body = stripNonElements(svg);
  const svgTag = /<svg\b[^>]*>/.exec(body)?.[0];
  if (!svgTag) throw new UnsafeSvgError(source, "missing <svg> root");
  const viewBox = attr(svgTag, "viewBox");
  if (!viewBox || !VIEWBOX.test(viewBox)) throw new UnsafeSvgError(source, "missing or invalid viewBox");

  const paths = Array.from(body.matchAll(/<path\b[^>]*>/g), ([tag]) => sanitizePath(tag, source, fillOf));
  if (paths.length === 0) throw new UnsafeSvgError(source, "no <path> elements");

  return `<svg viewBox="${viewBox.trim()}" aria-hidden="true" focusable="false">${paths.join("")}</svg>`;
}

/** Returns sanitized inline SVG: currentColor fill, aria-hidden, no size/title. */
export function sanitizeIconSvg(svg: string, source: string): string {
  return rebuildSvg(svg, source, () => "currentColor");
}

/** Returns sanitized multicolor logo: each path keeps its own hex fill (REQ-022, REQ-023). */
export function sanitizeLogoSvg(svg: string, source: string): string {
  return rebuildSvg(svg, source, (tag) => {
    const fill = attr(tag, "fill");
    if (!fill || !HEX_FILL.test(fill)) throw new UnsafeSvgError(source, "logo path fill must be #rgb or #rrggbb");
    return fill;
  });
}
