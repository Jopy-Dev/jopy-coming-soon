import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

// Regression guard: an unquoted "key: value" inside a step name made GitHub reject ci.yml (0 jobs ran).
const GITHUB_DIR = resolve(import.meta.dirname, "../.github");
const yamlFiles = [
  ...readdirSync(join(GITHUB_DIR, "workflows")).map((f) => join("workflows", f)),
  "dependabot.yml",
].filter((f) => /\.ya?ml$/.test(f));

describe("GitHub config files are valid YAML", () => {
  it.each(yamlFiles)("%s parses without errors", (file) => {
    const doc = parseDocument(readFileSync(join(GITHUB_DIR, file), "utf8"));
    expect(doc.errors.map((e) => e.message)).toEqual([]);
  });

  it.each(yamlFiles.filter((f) => f.startsWith("workflows")))("%s defines jobs with steps", (file) => {
    const wf = parseDocument(readFileSync(join(GITHUB_DIR, file), "utf8")).toJS() as { jobs?: Record<string, { steps?: unknown[] }> };
    expect(Object.keys(wf.jobs ?? {}).length).toBeGreaterThan(0);
    for (const job of Object.values(wf.jobs ?? {})) expect(job.steps?.length ?? 0).toBeGreaterThan(0);
  });
});
