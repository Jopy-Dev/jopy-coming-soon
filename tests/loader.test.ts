// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOADER, loaderTimeline, mountLoader, progressAt } from "../src/effects/loader";
import { Scheduler } from "../src/lib/pausable-timer";
import { maxResolveMs } from "../src/effects/scramble";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  document.documentElement.className = "";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("REQ-023 loader timeline", () => {
  it("worst case = both scrambles at their bounds plus two steady 1s pauses, fade still inside the 5s cap", () => {
    const { maxSequenceMs } = loaderTimeline();
    expect(LOADER.loadingPauseMs).toBe(1000);
    expect(LOADER.welcomePauseMs).toBe(1000);
    expect(maxSequenceMs).toBe(maxResolveMs(LOADER.loadingText.length) + LOADER.loadingPauseMs + maxResolveMs(LOADER.welcomeText.length) + LOADER.welcomePauseMs);
    expect(maxSequenceMs + LOADER.fadeMs).toBeLessThan(LOADER.capMs);
  });

  it("bar tracks elapsed time, holds at 90% until ready, never exceeds full", () => {
    const { maxSequenceMs } = loaderTimeline();
    expect(progressAt(0, true)).toBe(0);
    expect(progressAt(maxSequenceMs / 2, true)).toBeCloseTo(0.5);
    expect(progressAt(maxSequenceMs, false)).toBe(LOADER.notReadyMax);
    expect(progressAt(maxSequenceMs * 2, true)).toBe(1);
    expect(progressAt(-50, true)).toBe(0);
  });
});

const LOADER_HTML = `
  <div class="loader" role="status" aria-label="Loading jopy.dev">
    <span class="loader__text" aria-hidden="true"><span class="loader__text-reserve">loading...</span><span class="loader__text-live"></span></span>
    <span class="loader__bar" aria-hidden="true"><span class="loader__bar-fill"></span></span>
  </div>
  <main class="hero"></main>`;

function setup(ready: Promise<unknown>) {
  document.body.innerHTML = LOADER_HTML;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  const root = document.querySelector<HTMLElement>(".loader")!;
  const main = document.querySelector<HTMLElement>("main")!;
  const live = root.querySelector<HTMLElement>(".loader__text-live")!;
  const fill = root.querySelector<HTMLElement>(".loader__bar-fill")!;
  const onRelease = vi.fn();
  mountLoader({ root, inertTargets: [main], scheduler: new Scheduler(), ready, onRelease, random: () => 0 });
  return { root, main, live, fill, onRelease };
}

describe("REQ-023 mountLoader", () => {
  it("pauses exactly 1s on resolved loading..., scrambles to welcome, pauses exactly 1s, then releases once", async () => {
    const { root, main, live, onRelease } = setup(Promise.resolve());
    expect(document.documentElement.classList.contains("is-loading")).toBe(true);
    expect(main.hasAttribute("inert")).toBe(true);

    const timeline: Record<string, number> = {};
    for (let t = 1; t <= 5000 && !root.classList.contains("is-released"); t++) {
      await vi.advanceTimersByTimeAsync(1);
      const text = live.textContent ?? "";
      if (text === LOADER.loadingText) timeline.loadingSettled ??= t;
      if (timeline.loadingSettled && text !== LOADER.loadingText) timeline.welcomeStarted ??= t;
      if (text === LOADER.welcomeText) timeline.welcomeSettled ??= t;
      if (root.classList.contains("is-released")) timeline.released ??= t;
    }
    expect(timeline.welcomeStarted! - timeline.loadingSettled!).toBe(LOADER.loadingPauseMs);
    expect(timeline.released! - timeline.welcomeSettled!).toBe(LOADER.welcomePauseMs);
    expect(onRelease).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(LOADER.fadeMs);
    expect(root.hidden).toBe(true);
    expect(main.hasAttribute("inert")).toBe(false);
    expect(document.documentElement.classList.contains("is-loading")).toBe(false);
    expect(onRelease).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LOADER.capMs);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});

describe("REQ-023 mountLoader edge paths", () => {
  it("holds the bar at 90% past the sequence until ready, then releases", async () => {
    let markReady!: () => void;
    const { root, fill, onRelease } = setup(new Promise<void>((r) => (markReady = r)));
    await vi.advanceTimersByTimeAsync(loaderTimeline().maxSequenceMs + 500);
    expect(fill.style.transform).toBe(`scaleX(${LOADER.notReadyMax})`);
    expect(root.classList.contains("is-released")).toBe(false);
    markReady();
    await vi.advanceTimersByTimeAsync(LOADER.fadeMs);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("releases at the hard cap when the page never becomes ready", async () => {
    const { root, onRelease } = setup(new Promise<void>(() => undefined));
    await vi.advanceTimersByTimeAsync(LOADER.capMs - 1);
    expect(root.classList.contains("is-released")).toBe(false);
    await vi.advanceTimersByTimeAsync(1 + LOADER.fadeMs);
    expect(root.hidden).toBe(true);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("back/forward cache restore releases immediately without fade", () => {
    const { root, main, onRelease } = setup(new Promise<void>(() => undefined));
    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    dispatchEvent(event);
    expect(root.hidden).toBe(true);
    expect(main.hasAttribute("inert")).toBe(false);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("ignores a normal (non-persisted) pageshow", () => {
    const { root } = setup(new Promise<void>(() => undefined));
    dispatchEvent(new Event("pageshow"));
    expect(root.hidden).toBe(false);
  });
});

describe("REQ-023 / REQ-015 skip handle", () => {
  it("skip() reveals the hero immediately (reduced motion turned on mid-sequence)", () => {
    document.body.innerHTML = LOADER_HTML;
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const root = document.querySelector<HTMLElement>(".loader")!;
    const main = document.querySelector<HTMLElement>("main")!;
    const onRelease = vi.fn();
    const handle = mountLoader({ root, inertTargets: [main], scheduler: new Scheduler(), ready: new Promise(() => undefined), onRelease });
    handle.skip();
    expect(root.hidden).toBe(true);
    expect(main.hasAttribute("inert")).toBe(false);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});

describe("REQ-023 defensive markup", () => {
  it("without a text element the screen still releases after the worst-case sequence", async () => {
    document.body.innerHTML = `<div class="loader"></div><main></main>`;
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const root = document.querySelector<HTMLElement>(".loader")!;
    const onRelease = vi.fn();
    mountLoader({ root, inertTargets: [], scheduler: new Scheduler(), ready: Promise.resolve(), onRelease });
    await vi.advanceTimersByTimeAsync(loaderTimeline().maxSequenceMs + LOADER.fadeMs);
    expect(root.hidden).toBe(true);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});
