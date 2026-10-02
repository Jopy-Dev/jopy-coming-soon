import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { sanitizeIconSvg } from "./svg-sanitize.ts";

const PLACEHOLDER = /<!--\s*icon:([a-z0-9-]+)\s*-->/g;

/** Replaces `<!-- icon:name -->` with sanitized `assets/icons/name.svg`; missing file fails the build (REQ-006). */
export function inlineIcons(iconDir: string): Plugin {
  return {
    name: "jopy:inline-icons",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(PLACEHOLDER, (_match, name: string) => {
          const file = resolve(iconDir, `${name}.svg`);
          let source: string;
          try {
            source = readFileSync(file, "utf8");
          } catch {
            throw new Error(`Icon "${name}" not found at ${file}`);
          }
          return sanitizeIconSvg(source, file);
        });
      },
    },
  };
}
