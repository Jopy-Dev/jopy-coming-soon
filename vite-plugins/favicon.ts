import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { assertSafeSvg } from "./svg-sanitize.ts";

/** Serves (dev) and emits (build) the user logo unmodified as /favicon.svg after a safety check (REQ-022). */
export function favicon(logoPath: string): Plugin {
  const load = (): string => {
    const svg = readFileSync(logoPath, "utf8");
    assertSafeSvg(svg, logoPath);
    return svg;
  };

  return {
    name: "jopy:favicon",
    configureServer(server) {
      server.middlewares.use("/favicon.svg", (_req, res) => {
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(load());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "favicon.svg", source: load() });
    },
  };
}
