import { PHRASES } from "./content/phrases";
import { mountCardSwarm } from "./effects/card-swarm";
import { mountDotField } from "./effects/dot-field";
import { mountFlair } from "./effects/flair";
import { mountLoader } from "./effects/loader";
import { isFinePointer, prefersReducedMotion, REDUCED_MOTION_QUERY } from "./lib/motion";
import { Scheduler } from "./lib/pausable-timer";

// Progressive enhancement: static markup works without this file (REQ-016).
document.documentElement.classList.replace("no-js", "js");

/** One failing effect must never block the others or the static page. */
function safeMount(name: string, mount: () => void): void {
  try {
    mount();
  } catch (error) {
    console.error(`[jopy] ${name} failed to mount`, error);
  }
}

const scheduler = new Scheduler();
scheduler.bindVisibility(document);

safeMount("dot-field", () => {
  const canvas = document.querySelector<HTMLCanvasElement>(".dot-field");
  if (canvas) mountDotField(canvas, prefersReducedMotion);
});

safeMount("flair", () => {
  const pill = document.querySelector<HTMLElement>(".pill");
  if (pill && isFinePointer() && !prefersReducedMotion()) mountFlair(pill);
});

const startCardSwarm = (): void =>
  safeMount("card-swarm", () => {
    const container = document.querySelector<HTMLElement>(".swarm");
    const exclusions = [".hero-copy", ".pill-wrap", ".rail"]
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((el): el is HTMLElement => el !== null);
    if (container) {
      mountCardSwarm({ container, exclusionTargets: exclusions, phrases: PHRASES, scheduler, reducedMotion: prefersReducedMotion });
    }
  });

/** Resolves once the window has loaded and web fonts are ready (REQ-023 bar completion gate). */
function pageReady(): Promise<unknown> {
  const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((resolve) => addEventListener("load", resolve, { once: true }));
  return Promise.all([loaded, document.fonts.ready]);
}

// REQ-023: loading screen first; cards start at reveal so they appear progressively.
// Reduced motion: CSS already hides the screen, so start immediately (REQ-015).
const loader = document.querySelector<HTMLElement>(".loader");
if (loader && !prefersReducedMotion()) {
  try {
    const inertTargets = ["main", ".pill-wrap", "nav"]
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((el): el is HTMLElement => el !== null);
    const handle = mountLoader({ root: loader, inertTargets, scheduler, ready: pageReady(), onRelease: startCardSwarm });
    matchMedia(REDUCED_MOTION_QUERY).addEventListener("change", (event) => {
      if (event.matches) handle.skip();
    });
  } catch (error) {
    // Never leave the hero locked behind a half-mounted screen.
    console.error("[jopy] loader failed to mount", error);
    document.documentElement.classList.remove("is-loading");
    for (const el of document.querySelectorAll("[inert]")) el.removeAttribute("inert");
    loader.hidden = true;
    startCardSwarm();
  }
} else {
  startCardSwarm();
}
