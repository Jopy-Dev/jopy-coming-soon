import type { HtmlTagDescriptor, Plugin } from "vite";

/** Injects <link rel="preload"> for critical woff2 files using hashed build names (LCP fonts). */
export function fontPreload(fileStems: readonly string[]): Plugin {
  return {
    name: "jopy:font-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const files = Object.keys(ctx.bundle);
        const tags: HtmlTagDescriptor[] = [];
        for (const stem of fileStems) {
          const file = files.find((name) => name.endsWith(".woff2") && name.includes(stem));
          if (!file) throw new Error(`Font preload: no bundled woff2 matches "${stem}"`);
          tags.push({
            tag: "link",
            attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${file}`, crossorigin: "" },
            injectTo: "head-prepend",
          });
        }
        return tags;
      },
    },
  };
}
