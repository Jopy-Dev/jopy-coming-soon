import type { Plugin } from "vite";

const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

/** Injects the Cloudflare Web Analytics beacon only when a token is configured (REQ-020). */
export function analyticsBeacon(token: string | undefined): Plugin {
  if (token !== undefined && token !== "" && !TOKEN_FORMAT.test(token)) {
    throw new Error("VITE_CF_BEACON_TOKEN has unexpected format");
  }
  return {
    name: "jopy:analytics-beacon",
    apply: "build",
    transformIndexHtml() {
      if (!token) return [];
      return [
        {
          tag: "script",
          attrs: { defer: true, src: BEACON_SRC, "data-cf-beacon": JSON.stringify({ token }) },
          injectTo: "body",
        },
      ];
    },
  };
}
