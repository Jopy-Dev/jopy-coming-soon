import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { sanitizeIconSvg, sanitizeLogoSvg } from "./svg-sanitize.ts";

const PLACEHOLDER = /<!--\s*icon:([a-z0-9-]+)\s*-->/g;
const LOGO_PLACEHOLDER = /<!--\s*logo\s*-->/g;

function read(file: string, label: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Error(`${label} not found at ${file}`);
  }
}

/**
 * Replaces `<!-- icon:name -->` with sanitized `assets/icons/name.svg` (REQ-006) and
 * `<!-- logo -->` with the sanitized multicolor `Logo.svg` (REQ-023); missing file fails the build.
 */
export function inlineIcons(iconDir: string): Plugin {
  return {
    name: "jopy:inline-icons",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replace(PLACEHOLDER, (_match, name: string) => {
            const file = resolve(iconDir, `${name}.svg`);
            return sanitizeIconSvg(read(file, `Icon "${name}"`), file);
          })
          .replace(LOGO_PLACEHOLDER, () => {
            const file = resolve(iconDir, "Logo.svg");
            return sanitizeLogoSvg(read(file, "Logo"), file);
          });
      },
    },
  };
}
