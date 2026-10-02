// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountCardSwarm, SWARM } from "../src/effects/card-swarm";
import { mountDotField } from "../src/effects/dot-field";
import { mountFlair } from "../src/effects/flair";
import { maxResolveMs, scrambleInto } from "../src/effects/scramble";
import { isFinePointer, prefersReducedMotion } from "../src/lib/motion";
import { Scheduler } from "../src/lib/pausable-timer";
import { PHRASES } from "../src/content/phrases";

type RectInit = { left: number; top: number; width: number; height: number };
const rect = ({ left, top, width, height }: RectInit): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

function stubMatchMedia(matches: Record<string, boolean>): void {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: matches[q] ?? false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  document.documentElement.className = "";
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("REQ-015 / REQ-005 motion queries", () => {
  it("reads reduced-motion and fine-pointer media queries", () => {
    stubMatchMedia({ "(prefers-reduced-motion: reduce)": true, "(hover: hover) and (pointer: fine)": false });
    expect(prefersReducedMotion()).toBe(true);
    expect(isFinePointer()).toBe(false);
  });
});

describe("REQ-012 Scheduler visibility binding", () => {
  it("pauses on hidden, resumes on visible; repeated pause/resume are no-ops", () => {
    const scheduler = new Scheduler();
    scheduler.bindVisibility(document);
    const fn = vi.fn();
    scheduler.later(fn, 1000);
    let hidden = true;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    document.dispatchEvent(new Event("visibilitychange"));
    scheduler.pause();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    scheduler.resume();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("REQ-012 scrambleInto", () => {
  it("reduced motion writes final text immediately", () => {
    const el = document.createElement("span");
    scrambleInto(el, "hello world", new Scheduler(), true);
    expect(el.textContent).toBe("hello world");
  });

  it("starts scrambled and resolves to final text within maxResolveMs", () => {
    const el = document.createElement("span");
    const text = PHRASES[0] ?? "";
    scrambleInto(el, text, new Scheduler(), false);
    expect(el.textContent).not.toBe(text);
    expect(el.children).toHaveLength(Array.from(text).length);
    vi.advanceTimersByTime(maxResolveMs(text.length) + 1);
    expect(el.textContent).toBe(text);
  });
});

describe("REQ-005 mountFlair", () => {
  it("adds flair, sizes to 2.2x diagonal on enter, scales out on leave", () => {
    const pill = document.createElement("a");
    document.body.appendChild(pill);
    vi.spyOn(pill, "getBoundingClientRect").mockReturnValue(rect({ left: 0, top: 0, width: 30, height: 40 }));
    mountFlair(pill);
    const flair = pill.querySelector<HTMLElement>(".flair")!;
    expect(flair.getAttribute("aria-hidden")).toBe("true");
    expect(document.documentElement.classList.contains("has-flair")).toBe(true);
    pill.dispatchEvent(new MouseEvent("pointerenter", { clientX: 10, clientY: 20 }));
    expect(parseFloat(flair.style.width)).toBeCloseTo(110);
    expect(flair.style.scale).toBe("1");
    pill.dispatchEvent(new MouseEvent("pointermove", { clientX: 20, clientY: 20 }));
    const [tx, ty] = flair.style.translate.split(" ").map(parseFloat);
    expect(tx).toBeCloseTo(-35);
    expect(ty).toBeCloseTo(-35);
    pill.dispatchEvent(new MouseEvent("pointerleave", { clientX: 30, clientY: 20 }));
    expect(flair.style.scale).toBe("0");
  });
});

describe("REQ-010 / REQ-011 mountDotField", () => {
  function setup(reduced: boolean) {
    const ctx = { clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), setTransform: vi.fn(), fillStyle: "" };
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.stubGlobal("innerWidth", 110);
    vi.stubGlobal("innerHeight", 66);
    mountDotField(canvas, () => reduced);
    return { canvas, ctx };
  }

  it("draws idle grid at DPR size", () => {
    const { canvas, ctx } = setup(false);
    expect(canvas.width).toBe(110 * (window.devicePixelRatio || 1));
    expect(ctx.arc).toHaveBeenCalledTimes(5 * 3); // 110/22 cols x 66/22 rows
  });

  it("click on empty area animates, then returns to idle", () => {
    const { ctx } = setup(false);
    ctx.arc.mockClear();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 50, clientY: 30 }));
    vi.advanceTimersByTime(100);
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(15);
    vi.advanceTimersByTime(3000);
    const lastStyle = ctx.fillStyle;
    expect(lastStyle).toBe("rgba(255, 255, 255, 0.09)");
  });

  it("ignores clicks on links and when reduced motion is on", () => {
    const { ctx } = setup(true);
    ctx.arc.mockClear();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 }));
    vi.advanceTimersByTime(100);
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("ignores clicks on interactive targets", () => {
    const { ctx } = setup(false);
    const link = document.createElement("a");
    document.body.appendChild(link);
    ctx.arc.mockClear();
    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    vi.advanceTimersByTime(100);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

describe("REQ-012..014 mountCardSwarm", () => {
  function setup(width: number, reduced = false) {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("innerHeight", 800);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const copy = document.createElement("div");
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue(rect({ left: 0, top: 0, width, height: 800 }));
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue(rect({ left: width / 2 - 100, top: 360, width: 200, height: 80 }));
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(16);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect({ left: 0, top: 0, width: 120, height: 16 }));
    const scheduler = new Scheduler();
    mountCardSwarm({ container, exclusionTargets: [copy], phrases: PHRASES, scheduler, reducedMotion: () => reduced, random: () => 0.5 });
    return { container, scheduler };
  }
  const cards = (c: HTMLElement) => c.querySelectorAll(".card");

  it("desktop spawns up to the rolled target (random 0.5 → 7) and only from the phrase pool", () => {
    const { container } = setup(1280);
    vi.advanceTimersByTime(SWARM.initialDelaysMs.at(-1)! + 50);
    expect(cards(container).length).toBe(7);
    for (const final of container.querySelectorAll(".card__final")) expect(PHRASES).toContain(final.textContent);
  });

  it("phones cap at 4", () => {
    const { container } = setup(375);
    vi.advanceTimersByTime(5000);
    expect(cards(container).length).toBeLessThanOrEqual(4);
  });

  it("cards fade after visible window and are replaced", () => {
    const { container } = setup(1280);
    vi.advanceTimersByTime(SWARM.initialDelaysMs[0]! + 50);
    const first = cards(container)[0]!;
    vi.advanceTimersByTime(SWARM.visibleMinMs + SWARM.visibleJitterMs * 0.5 + SWARM.fadeMs + 50);
    expect(first.isConnected).toBe(false);
    expect(cards(container).length).toBeGreaterThan(0);
  });

  it("reduced motion shows final text without scramble", () => {
    const { container } = setup(1280, true);
    vi.advanceTimersByTime(SWARM.initialDelaysMs[0]! + 50);
    const card = cards(container)[0]!;
    expect(card.querySelector(".card__live")!.textContent).toBe(card.querySelector(".card__final")!.textContent);
  });

  it("no spawns while paused (tab hidden)", () => {
    const { container, scheduler } = setup(1280);
    scheduler.pause();
    vi.advanceTimersByTime(10_000);
    expect(cards(container).length).toBe(0);
    scheduler.resume();
    vi.advanceTimersByTime(SWARM.initialDelaysMs[0]! + 50);
    expect(cards(container).length).toBeGreaterThan(0);
  });

  it("crossing the 640px breakpoint re-rolls target and refills", () => {
    const { container } = setup(375);
    vi.advanceTimersByTime(5000);
    expect(cards(container).length).toBeLessThanOrEqual(4);
    vi.stubGlobal("innerWidth", 1280);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(3000);
    expect(cards(container).length).toBeGreaterThan(4);
  });

  it("skips spawning when no placement fits, then retries", () => {
    vi.stubGlobal("innerWidth", 1280);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const blocker = document.createElement("div");
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue(rect({ left: 0, top: 0, width: 1280, height: 800 }));
    vi.spyOn(blocker, "getBoundingClientRect").mockReturnValue(rect({ left: 0, top: 0, width: 1280, height: 800 }));
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    mountCardSwarm({ container, exclusionTargets: [blocker], phrases: PHRASES, scheduler: new Scheduler(), reducedMotion: () => false, random: () => 0.5 });
    vi.advanceTimersByTime(6000);
    expect(cards(container).length).toBe(0);
  });
});

describe("REQ-023 scrambleInto completion", () => {
  it("calls onDone once, exactly when the final text has settled", async () => {
    const live = document.createElement("span");
    const onDone = vi.fn();
    const scheduler = new Scheduler();
    scrambleInto(live, "ab.", scheduler, false, () => 0, onDone);
    let settledAt = -1;
    for (let t = 1; t <= maxResolveMs(3) + 5; t++) {
      await vi.advanceTimersByTimeAsync(1);
      if (settledAt < 0 && live.textContent === "ab.") settledAt = t;
      if (onDone.mock.calls.length && settledAt < 0) throw new Error("onDone before text settled");
    }
    expect(settledAt).toBeGreaterThan(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone immediately when reduced motion renders final text", () => {
    const live = document.createElement("span");
    const onDone = vi.fn();
    scrambleInto(live, "welcome", new Scheduler(), true, Math.random, onDone);
    expect(live.textContent).toBe("welcome");
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
