import type { Scheduler } from "../lib/pausable-timer";
import { scrambleInto } from "./scramble";

// REQ-012..014: card bands, spacing, timing, and concurrency limits.
export const SWARM = {
  visibleMinMs: 5000,
  visibleJitterMs: 3000,
  fadeMs: 600,
  respawnMinMs: 100,
  respawnJitterMs: 600,
  initialDelaysMs: [400, 900, 1400, 1900, 2400, 2900, 3400, 3900],
  retryMs: 800,
  candidates: 12,
  xRange: [8, 92],
  topBand: [14, 42],
  bottomBand: [58, 86],
  yWeight: 2.5,
  exclusionPadPx: 16,
  cardGapPx: 8,
  edgePx: 8,
} as const;

export const MOBILE_BREAKPOINT = 640;

export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Placed { x: number; y: number; rect: Rect }

/** Concurrent card target: phones 4, otherwise random 5-8 (re-rolled per exit). */
export function rollTarget(viewportWidth: number, random: () => number): number {
  return viewportWidth < MOBILE_BREAKPOINT ? 4 : 5 + Math.floor(random() * 4);
}

export function inflate(r: Rect, pad: number): Rect {
  return { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad };
}

export function intersects(first: Rect, second: Rect): boolean {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}

/** Best of N random band positions maximising distance to live cards; null when nothing fits. */
export function pickPlacement(
  container: Rect,
  size: { width: number; height: number },
  exclusions: readonly Rect[],
  live: readonly Placed[],
  random: () => number,
): { x: number; y: number } | null {
  const cw = container.right - container.left;
  const ch = container.bottom - container.top;
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < SWARM.candidates; i++) {
    const [xMin, xMax] = SWARM.xRange;
    const band = random() < 0.5 ? SWARM.topBand : SWARM.bottomBand;
    const x = xMin + (xMax - xMin) * random();
    const y = band[0] + (band[1] - band[0]) * random();
    const cx = container.left + (cw * x) / 100;
    const cy = container.top + (ch * y) / 100;
    const rect = { left: cx - size.width / 2, top: cy - size.height / 2, right: cx + size.width / 2, bottom: cy + size.height / 2 };
    if (rect.left < container.left + SWARM.edgePx || rect.right > container.right - SWARM.edgePx) continue;
    if (exclusions.some((e) => intersects(rect, e))) continue;
    if (live.some((c) => intersects(rect, inflate(c.rect, SWARM.cardGapPx)))) continue;
    const score = live.length === 0 ? Infinity : Math.min(...live.map((c) => Math.hypot(c.x - x, (c.y - y) * SWARM.yWeight)));
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

interface SwarmOptions {
  container: HTMLElement;
  exclusionTargets: readonly HTMLElement[];
  phrases: readonly string[];
  scheduler: Scheduler;
  reducedMotion: () => boolean;
  random?: () => number;
}

export function mountCardSwarm(opts: SwarmOptions): void {
  const { container, exclusionTargets, phrases, scheduler, reducedMotion } = opts;
  const random = opts.random ?? Math.random;
  let target = rollTarget(window.innerWidth, random);
  let slots = 0; // live (non-fading) cards + scheduled spawns
  let cursor = 0;
  let live: Placed[] = [];

  const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

  const maxCardWidth = (): number => {
    const width = container.getBoundingClientRect().width;
    const rail = window.innerWidth < MOBILE_BREAKPOINT ? 60 : 0;
    return width - 2 * SWARM.exclusionPadPx - rail;
  };

  const takePhrase = (probe: HTMLElement): string | null => {
    const limit = maxCardWidth();
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[cursor % phrases.length] ?? "";
      cursor += 1;
      probe.textContent = phrase;
      if (probe.offsetWidth <= limit) return phrase;
    }
    return null;
  };

  const spawn = (): void => {
    if (live.length >= target) {
      slots -= 1;
      return;
    }
    const card = document.createElement("span");
    card.className = "card";
    const finalText = document.createElement("span");
    finalText.className = "card__final";
    card.appendChild(finalText);
    container.appendChild(card);

    const phrase = takePhrase(finalText);
    const spot = phrase
      ? pickPlacement(
          toRect(container.getBoundingClientRect()),
          { width: card.offsetWidth, height: card.offsetHeight },
          exclusionTargets.map((el) => inflate(toRect(el.getBoundingClientRect()), SWARM.exclusionPadPx)),
          live,
          random,
        )
      : null;
    if (!phrase || !spot) {
      card.remove();
      if (phrase) cursor -= 1; // retry same phrase next time
      scheduler.later(spawn, SWARM.retryMs);
      return;
    }

    card.style.left = `${spot.x}%`;
    card.style.top = `${spot.y}%`;
    const liveText = document.createElement("span");
    liveText.className = "card__live";
    card.appendChild(liveText);
    const entry: Placed = { x: spot.x, y: spot.y, rect: toRect(card.getBoundingClientRect()) };
    live.push(entry);
    const reduced = reducedMotion();
    scrambleInto(liveText, phrase, scheduler, reduced, random);
    requestAnimationFrame(() => card.classList.add("is-visible"));

    scheduler.later(() => {
      card.classList.remove("is-visible");
      // Free the slot as fade starts so the replacement overlaps the fade-out.
      live = live.filter((c) => c !== entry);
      slots -= 1;
      target = rollTarget(window.innerWidth, random);
      fill(SWARM.respawnMinMs + random() * SWARM.respawnJitterMs);
      scheduler.later(() => card.remove(), reduced ? 0 : SWARM.fadeMs);
    }, SWARM.visibleMinMs + random() * SWARM.visibleJitterMs);
  };

  const fill = (delayMs?: number): void => {
    let queued = 0;
    while (slots < target) {
      const delay = delayMs !== undefined ? delayMs + queued * 500 : (SWARM.initialDelaysMs[slots] ?? 0);
      slots += 1;
      queued += 1;
      scheduler.later(spawn, delay);
    }
  };

  let mobile = window.innerWidth < MOBILE_BREAKPOINT;
  window.addEventListener("resize", () => {
    const nowMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (nowMobile === mobile) return;
    mobile = nowMobile;
    target = rollTarget(window.innerWidth, random);
    fill(0);
  });
  fill();
}
