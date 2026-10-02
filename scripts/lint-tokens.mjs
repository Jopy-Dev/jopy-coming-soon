// Token discipline lint: raw colour literals are allowed only in src/styles/tokens.css.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STYLES = join(import.meta.dirname, "..", "src", "styles");
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;

let violations = 0;
for (const file of readdirSync(STYLES).filter((f) => f.endsWith(".css") && f !== "tokens.css")) {
  readFileSync(join(STYLES, file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.trim().startsWith("/*")) return;
      for (const match of line.matchAll(RAW_COLOR)) {
        violations += 1;
        console.error(`lint-tokens: src/styles/${file}:${i + 1} raw colour "${match[0]}" — use a --color-* token`);
      }
    });
}
console.log(violations === 0 ? "lint-tokens: PASS (no raw colours outside tokens.css)" : `lint-tokens: FAIL (${violations})`);
process.exit(violations === 0 ? 0 : 1);
