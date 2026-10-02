import { PHRASES } from "./content/phrases";
import { mountCardSwarm } from "./effects/card-swarm";
import { mountDotField } from "./effects/dot-field";
import { mountFlair } from "./effects/flair";
import { isFinePointer, prefersReducedMotion } from "./lib/motion";
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

safeMount("card-swarm", () => {
  const container = document.querySelector<HTMLElement>(".swarm");
  const exclusions = [".hero-copy", ".pill-wrap", ".rail"]
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .filter((el): el is HTMLElement => el !== null);
  if (container) {
    mountCardSwarm({ container, exclusionTargets: exclusions, phrases: PHRASES, scheduler, reducedMotion: prefersReducedMotion });
  }
});
