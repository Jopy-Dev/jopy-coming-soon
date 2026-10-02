import { describe, expect, it } from "vitest";
import { inflate, intersects, pickPlacement, rollTarget, SWARM, type Placed, type Rect } from "../src/effects/card-swarm";
import { PHRASE_MAX_LENGTH, PHRASES } from "../src/content/phrases";

const seq = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};
const viewport: Rect = { left: 0, top: 0, right: 1280, bottom: 800 };
const size = { width: 200, height: 16 };

describe("REQ-012 / REQ-013 card target", () => {
  it("phones always 4", () => {
    expect(rollTarget(375, () => 0.99)).toBe(4);
  });
  it("≥ 640px spans exactly 5..8", () => {
    expect(rollTarget(1280, () => 0)).toBe(5);
    expect(rollTarget(1280, () => 0.999)).toBe(8);
    expect(rollTarget(640, () => 0.5)).toBe(7);
  });
});

describe("REQ-012 timing bounds", () => {
  it("visible 5-8s, fade 600ms, respawn 100-700ms", () => {
    expect(SWARM.visibleMinMs).toBe(5000);
    expect(SWARM.visibleMinMs + SWARM.visibleJitterMs).toBe(8000);
    expect(SWARM.fadeMs).toBe(600);
    expect([SWARM.respawnMinMs, SWARM.respawnMinMs + SWARM.respawnJitterMs]).toEqual([100, 700]);
  });
});

describe("REQ-012 placement", () => {
  it("never returns a spot overlapping an exclusion zone", () => {
    const copy: Rect = inflate({ left: 300, top: 300, right: 980, bottom: 520 }, SWARM.exclusionPadPx);
    for (let trial = 0; trial < 200; trial++) {
      const spot = pickPlacement(viewport, size, [copy], [], Math.random);
      if (!spot) continue;
      const cx = (viewport.right * spot.x) / 100;
      const cy = (viewport.bottom * spot.y) / 100;
      const rect = { left: cx - 100, top: cy - 8, right: cx + 100, bottom: cy + 8 };
      expect(intersects(rect, copy)).toBe(false);
      expect(spot.y < 42 || spot.y > 58).toBe(true);
    }
  });

  it("returns null when every candidate collides", () => {
    const everything: Rect = { left: -1, top: -1, right: 2000, bottom: 2000 };
    expect(pickPlacement(viewport, size, [everything], [], Math.random)).toBeNull();
  });

  it("prefers the candidate farthest from live cards", () => {
    const live: Placed[] = [{ x: 10, y: 20, rect: { left: 0, top: 0, right: 1, bottom: 1 } }];
    // candidates: (band top, x≈8.84, y≈16.8) then (band top, x≈83.6, y≈16.8); later draws repeat
    const spot = pickPlacement(viewport, { width: 10, height: 10 }, [], live, seq([0.1, 0.01, 0.1, 0.1, 0.9, 0.1]));
    expect(spot?.x).toBeGreaterThan(50);
  });
});

describe("card phrase pool", () => {
  it("has exactly 16 unique phrases within the length cap", () => {
    expect(PHRASES).toHaveLength(16);
    expect(new Set(PHRASES).size).toBe(16);
    for (const p of PHRASES) expect(p.length).toBeLessThanOrEqual(PHRASE_MAX_LENGTH);
  });
});
