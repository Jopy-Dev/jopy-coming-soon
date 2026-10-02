// REQ-010 / REQ-011: dot grid canvas + click ripple (values are the design motion tokens).
export const DOT = { pitch: 22, offset: 11, radius: 1, baseAlpha: 0.09 } as const;
export const RIPPLE = { life: 2.2, speed: 380, band: 80, amplitude: 14, brightness: 0.28, max: 6 } as const;

const IGNORE_TARGETS = "a, button, [role='button']";

export interface Ripple {
  readonly x: number;
  readonly y: number;
  readonly startedAt: number; // seconds
}

export interface LiveRipple {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly amplitude: number;
  readonly brightness: number;
}

export function liveRipple(r: Ripple, now: number): LiveRipple | null {
  const age = now - r.startedAt;
  if (age < 0 || age >= RIPPLE.life) return null;
  const decay = 1 - age / RIPPLE.life;
  return { x: r.x, y: r.y, radius: RIPPLE.speed * age, amplitude: RIPPLE.amplitude * decay, brightness: RIPPLE.brightness * decay };
}

/** Position + alpha of the grid dot at (x, y) under the active ripples. */
export function displaceDot(x: number, y: number, ripples: readonly LiveRipple[]): { x: number; y: number; alpha: number } {
  let px = x;
  let py = y;
  let alpha: number = DOT.baseAlpha;
  for (const r of ripples) {
    const dx = x - r.x;
    const dy = y - r.y;
    const dist = Math.hypot(dx, dy);
    const offset = dist - r.radius;
    if (Math.abs(offset) >= RIPPLE.band) continue;
    const falloff = Math.cos((offset / RIPPLE.band) * Math.PI * 0.5);
    const inv = dist > 0.001 ? 1 / dist : 0;
    px += dx * inv * falloff * r.amplitude;
    py += dy * inv * falloff * r.amplitude;
    alpha += r.brightness * Math.max(0, falloff);
  }
  return { x: px, y: py, alpha: Math.min(1, alpha) };
}

/** Adds a ripple, dropping the oldest beyond the cap. */
export function pushRipple(list: readonly Ripple[], ripple: Ripple): Ripple[] {
  const next = [...list, ripple];
  return next.length > RIPPLE.max ? next.slice(next.length - RIPPLE.max) : next;
}

export function mountDotField(canvas: HTMLCanvasElement, reducedMotion: () => boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let width = 0;
  let height = 0;
  let ripples: Ripple[] = [];
  let running = false;
  let resizeFrame = 0;

  const dot = (x: number, y: number, alpha: number): void => {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, DOT.radius, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawIdle = (): void => {
    ctx.clearRect(0, 0, width, height);
    for (let y = DOT.offset; y < height; y += DOT.pitch) for (let x = DOT.offset; x < width; x += DOT.pitch) dot(x, y, DOT.baseAlpha);
  };

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) drawIdle();
  };

  const frame = (): void => {
    const now = performance.now() / 1000;
    const live = ripples.map((r) => liveRipple(r, now)).filter((r): r is LiveRipple => r !== null);
    ripples = ripples.filter((r) => liveRipple(r, now) !== null);
    if (live.length === 0 || document.hidden) {
      running = false;
      ripples = document.hidden ? [] : ripples;
      drawIdle();
      return;
    }
    ctx.clearRect(0, 0, width, height);
    for (let y = DOT.offset; y < height; y += DOT.pitch) {
      for (let x = DOT.offset; x < width; x += DOT.pitch) {
        const d = displaceDot(x, y, live);
        dot(d.x, d.y, d.alpha);
      }
    }
    requestAnimationFrame(frame);
  };

  window.addEventListener("click", (event) => {
    if (reducedMotion()) return;
    const target = event.target;
    if (target instanceof Element && target.closest(IGNORE_TARGETS)) return;
    ripples = pushRipple(ripples, { x: event.clientX, y: event.clientY, startedAt: performance.now() / 1000 });
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resize);
  });
  resize();
}
