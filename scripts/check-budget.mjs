// REQ-901: total gzip size of shipped JS must stay within budget (analytics beacon is external, excluded).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 25 * 1024;
const assetsDir = join(import.meta.dirname, "..", "dist", "assets");

if (!existsSync(assetsDir)) {
  console.error("check-budget: dist/assets missing, run `npm run build` first");
  process.exit(1);
}

const files = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
let total = 0;
for (const file of files) {
  const size = gzipSync(readFileSync(join(assetsDir, file))).length;
  total += size;
  console.log(`  ${file}: ${size} B gzip`);
}
console.log(`check-budget: ${total} B / ${BUDGET_BYTES} B`);
if (total > BUDGET_BYTES) {
  console.error("check-budget: FAILED, JS budget exceeded");
  process.exit(1);
}
