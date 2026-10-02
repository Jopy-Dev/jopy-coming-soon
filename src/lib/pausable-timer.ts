interface Timer {
  readonly fn: () => void;
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | undefined;
}

/**
 * setTimeout wrapper that freezes all pending timers while paused (tab hidden),
 * so returning to the tab never fires a burst of overdue callbacks (REQ-012).
 */
export class Scheduler {
  private readonly timers = new Set<Timer>();
  private paused = false;

  constructor(private readonly now: () => number = () => performance.now()) {}

  later(fn: () => void, ms: number): void {
    const timer: Timer = { fn, remaining: Math.max(0, ms), startedAt: this.now(), handle: undefined };
    this.timers.add(timer);
    if (!this.paused) this.arm(timer);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = this.now();
    for (const timer of this.timers) {
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const timer of this.timers) this.arm(timer);
  }

  get pending(): number {
    return this.timers.size;
  }

  /** Wires pause/resume to page visibility. */
  bindVisibility(doc: Document): void {
    doc.addEventListener("visibilitychange", () => (doc.hidden ? this.pause() : this.resume()));
  }

  private arm(timer: Timer): void {
    timer.startedAt = this.now();
    timer.handle = setTimeout(() => {
      this.timers.delete(timer);
      timer.fn();
    }, timer.remaining);
  }
}
