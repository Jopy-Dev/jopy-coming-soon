// Pre-deploy scan stack: Semgrep (SAST) -> Trivy fs (dependency CVEs + misconfig) -> Gitleaks (secrets).
// Runs all three, prints versions, exits non-zero if ANY fails. No bypass flags.
// Deviation: `semgrep ci --error` is rejected by semgrep >= 1.178 (unknown option); `semgrep scan --error` is the equivalent.
import { spawnSync } from "node:child_process";

const SEMGREP_PACKS = ["p/typescript", "p/javascript", "p/owasp-top-ten", "p/secrets"];

const steps = [
  { name: "semgrep", version: ["semgrep", ["--version"]], run: ["semgrep", ["scan", ...SEMGREP_PACKS.flatMap((p) => ["--config", p]), "--error", "--metrics=off"]] },
  { name: "trivy", version: ["trivy", ["--version"]], run: ["trivy", ["fs", "--scanners", "vuln,misconfig", "--severity", "HIGH,CRITICAL", "--exit-code", "1", "--ignorefile", ".trivyignore", "."]] },
  { name: "gitleaks", version: ["gitleaks", ["version"]], run: ["gitleaks", ["detect", "--no-banner", "--redact", "--exit-code", "1", "--config", ".gitleaks.toml"]] },
];

let failed = 0;
for (const step of steps) {
  const [vCmd, vArgs] = step.version;
  const v = spawnSync(vCmd, vArgs, { encoding: "utf8", shell: process.platform === "win32" });
  if (v.status !== 0) {
    console.error(`scan:predeploy: ${step.name} not installed`);
    failed += 1;
    continue;
  }
  console.log(`\n== ${step.name} ${v.stdout.split("\n")[0].trim()} ==`);
  const [cmd, args] = step.run;
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`scan:predeploy: ${step.name} FAILED (exit ${r.status})`);
    failed += 1;
  }
}

console.log(failed === 0 ? "\nscan:predeploy: PASS" : `\nscan:predeploy: FAIL (${failed} tool(s))`);
process.exit(failed === 0 ? 0 : 1);
