import type { Scheduler } from "../lib/pausable-timer";
import { maxResolveMs, scrambleInto } from "./scramble";

// REQ-023: loading screen sequence. Scramble timing reuses the card constants (REQ-012);
// each pause starts when its text has actually settled, so it is identical on every load.
export const LOADER = {
  loadingText: "loading...",
  welcomeText: "welcome",
  loadingPauseMs: 1000,
  welcomePauseMs: 1000,
  fadeMs: 600,
  capMs: 5000,
  notReadyMax: 0.9,
} as const;

export interface LoaderTimeline {
  /** Upper bound of the sequence before the fade (both scrambles at their worst case). */
  readonly maxSequenceMs: number;
}

export function loaderTimeline(): LoaderTimeline {
  return {
    maxSequenceMs:
      maxResolveMs(LOADER.loadingText.length) + LOADER.loadingPauseMs + maxResolveMs(LOADER.welcomeText.length) + LOADER.welcomePauseMs,
  };
}

/** Bar fill 0..1: follows elapsed time over the worst-case sequence, holding below full until the page is ready. */
export function progressAt(elapsedMs: number, ready: boolean): number {
  const linear = Math.max(0, elapsedMs) / loaderTimeline().maxSequenceMs;
  return Math.min(linear, ready ? 1 : LOADER.notReadyMax);
}

export interface LoaderOptions {
  readonly root: HTMLElement;
  readonly inertTargets: readonly HTMLElement[];
  readonly scheduler: Scheduler;
  /** Resolves when the page and fonts are loaded. */
  readonly ready: Promise<unknown>;
  readonly onRelease: () => void;
  readonly random?: () => number;
}

export interface LoaderHandle {
  /** Reveals the hero at once, without fade (e.g. reduced motion enabled mid-sequence). */
  skip(): void;
}

/**
 * Plays the loading sequence over the already-rendered hero, then reveals it.
 * Wall-clock timers (cap, fade) bypass the scheduler so a hidden tab can never keep the hero locked.
 */
export function mountLoader({ root, inertTargets, scheduler, ready, onRelease, random = Math.random }: LoaderOptions): LoaderHandle {
  const live = root.querySelector<HTMLElement>(".loader__text-live");
  const fill = root.querySelector<HTMLElement>(".loader__bar-fill");
  const start = performance.now();
  const html = document.documentElement;
  let isReady = false;
  let sequenceDone = false;
  let released = false;
  let frame = 0;

  html.classList.add("is-loading");
  for (const target of inertTargets) target.setAttribute("inert", "");
  // Anchor for timing checks: the sequence (and its 5s cap) runs from script start, not navigation.
  performance.mark("jopy:loader-start");

  const setFill = (value: number): void => {
    if (fill) fill.style.transform = `scaleX(${value})`;
  };

  const finish = (): void => {
    root.hidden = true;
    for (const target of inertTargets) target.removeAttribute("inert");
    html.classList.remove("is-loading");
    removeEventListener("pageshow", onPageShow);
    onRelease();
  };

  const release = (skipFade: boolean): void => {
    if (released) return;
    released = true;
    cancelAnimationFrame(frame);
    clearTimeout(cap);
    setFill(1);
    root.classList.add("is-released");
    if (skipFade) finish();
    else setTimeout(finish, LOADER.fadeMs);
  };

  const maybeRelease = (): void => {
    if (sequenceDone && isReady) release(false);
  };

  const tick = (): void => {
    setFill(progressAt(performance.now() - start, isReady));
    frame = requestAnimationFrame(tick);
  };

  function onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) release(true);
  }

  const cap = setTimeout(() => release(false), LOADER.capMs);
  addEventListener("pageshow", onPageShow);
  void ready.then(() => {
    isReady = true;
    maybeRelease();
  });

  const endSequence = (): void => {
    sequenceDone = true;
    maybeRelease();
  };
  const showWelcome = (target: HTMLElement): void =>
    scrambleInto(target, LOADER.welcomeText, scheduler, false, random, () => scheduler.later(endSequence, LOADER.welcomePauseMs));

  if (live) {
    scrambleInto(live, LOADER.loadingText, scheduler, false, random, () => scheduler.later(() => showWelcome(live), LOADER.loadingPauseMs));
  } else {
    scheduler.later(endSequence, loaderTimeline().maxSequenceMs);
  }
  frame = requestAnimationFrame(tick);
  return { skip: () => release(true) };
}
