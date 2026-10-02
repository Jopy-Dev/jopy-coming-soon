import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOT, RIPPLE, displaceDot, liveRipple, pushRipple, type Ripple } from "../src/effects/dot-field";
import { FLAIR_SCALE, flairDiameter } from "../src/effects/flair";
import { GLYPHS, isScrambled, maxResolveMs } from "../src/effects/scramble";
import { Scheduler } from "../src/lib/pausable-timer";
import { PHRASES } from "../src/content/phrases";

describe("REQ-011 ripple", () => {
  it("dot outside the ripple band is untouched", () => {
    const live = liveRipple({ x: 0, y: 0, startedAt: 0 }, 1)!;
    expect(displaceDot(1000, 1000, [live])).toEqual({ x: 1000, y: 1000, alpha: DOT.baseAlpha });
  });

  it("dot on the ring is pushed outward and brightened", () => {
    const live = liveRipple({ x: 0, y: 0, startedAt: 0 }, 0.5)!; // radius 190
    const d = displaceDot(190, 0, [live]);
    expect(d.x).toBeGreaterThan(190);
    expect(d.alpha).toBeGreaterThan(DOT.baseAlpha);
  });

  it("expires after its lifetime", () => {
    expect(liveRipple({ x: 0, y: 0, startedAt: 0 }, RIPPLE.life)).toBeNull();
  });

  it("caps concurrent ripples, dropping the oldest", () => {
    let list: Ripple[] = [];
    for (let i = 0; i < 8; i++) list = pushRipple(list, { x: i, y: 0, startedAt: i });
    expect(list).toHaveLength(RIPPLE.max);
    expect(list[0]?.x).toBe(2);
  });
});

describe("REQ-005 flair", () => {
  it("diameter = 2.2 × button diagonal", () => {
    expect(flairDiameter(3, 4)).toBeCloseTo(FLAIR_SCALE * 5);
  });
});

describe("REQ-012 scramble", () => {
  it("scrambles letters/digits only", () => {
    expect(isScrambled("a")).toBe(true);
    expect(isScrambled("7")).toBe(true);
    expect(isScrambled(" ")).toBe(false);
    expect(isScrambled("?")).toBe(false);
    expect(GLYPHS.length).toBeGreaterThan(100);
  });

  it("longest phrase resolves within 1.5s", () => {
    const longest = Math.max(...PHRASES.map((p) => p.length));
    expect(maxResolveMs(longest)).toBeLessThanOrEqual(1500);
  });
});

describe("Scheduler pause/resume (tab hidden)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("freezes remaining time while paused, no burst on resume", () => {
    let now = 0;
    const scheduler = new Scheduler(() => now);
    const fn = vi.fn();
    scheduler.later(fn, 1000);
    now = 400;
    vi.advanceTimersByTime(400);
    scheduler.pause();
    now = 10_400;
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
    scheduler.resume();
    vi.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(scheduler.pending).toBe(0);
  });
});
