// Outbound-URL guard: enforces an allowlist of hosts referenced by the built site.
// Catches leaked staging/preview/tracking URLs before deploy.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = join(import.meta.dirname, "..", "dist");
const ALLOWED_HOSTS = new Set([
  "jopy.dev",
  "portfolio.jopy.dev",
  "www.linkedin.com",
  "github.com",
  "static.cloudflareinsights.com",
  "cloudflareinsights.com",
  "www.w3.org", // SVG/XML namespace identifiers
]);
// Group 1 = host. Stops at path, quotes, CSP separators. Handles _headers placeholders (`:project.pages.dev`).
const URL_PATTERN = /https?:\/\/([^/\s"'<>);,\\]+)/g;

if (!existsSync(DIST)) {
  console.error("url-guard: dist/ missing, run `npm run build` first");
  process.exit(1);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

let violations = 0;
for (const file of walk(DIST).filter((f) => /\.(html|js|css|txt|svg)$/.test(f) || f.endsWith("_headers"))) {
  for (const match of readFileSync(file, "utf8").matchAll(URL_PATTERN)) {
    const host = (match[1] ?? "").toLowerCase();
    if (!ALLOWED_HOSTS.has(host) && !host.endsWith(".pages.dev")) {
      violations += 1;
      console.error(`url-guard: ${relative(DIST, file)} contains non-allowlisted URL ${match[0]}`);
    }
  }
}
console.log(violations === 0 ? "url-guard: PASS (all URLs allowlisted)" : `url-guard: FAIL (${violations})`);
process.exit(violations === 0 ? 0 : 1);
