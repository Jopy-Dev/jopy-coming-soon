import type { Scheduler } from "../lib/pausable-timer";

// Visual-only glyph pool: Hiragana, Arabic, Hangul, CJK (REQ-012).
export const GLYPHS: readonly string[] = Array.from(
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん" +
    "ابتثجحخدذرزسشصضطظعغفقكلمنهوي" +
    "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허" +
    "人大小天地中国王道德文学新水火山风云雷电星空生死爱情家光明亮金银玉龙虎凤马牛羊鸟鱼花草树木林海洋时年月日春夏秋冬东西南北心力气",
);

export const SCRAMBLE = { baseCycles: 8, cycleJitter: 5, baseStepMs: 35, stepJitterMs: 20, staggerMs: 22 } as const;

const SCRAMBLES = /[\p{L}\p{N}]/u;

export function isScrambled(char: string): boolean {
  return SCRAMBLES.test(char);
}

export function randomGlyph(random: () => number): string {
  return GLYPHS[Math.floor(random() * GLYPHS.length)] ?? "";
}

/** Worst-case time for a phrase to resolve to final text. */
export function maxResolveMs(length: number): number {
  const maxCycles = SCRAMBLE.baseCycles + SCRAMBLE.cycleJitter - 1;
  const maxStep = SCRAMBLE.baseStepMs + SCRAMBLE.stepJitterMs - 1;
  return Math.max(0, length - 1) * SCRAMBLE.staggerMs + maxCycles * maxStep;
}

/** Fills `live` with per-char spans that cycle random glyphs, then settle on `text`; `onDone` fires once all have settled. */
export function scrambleInto(
  live: HTMLElement,
  text: string,
  scheduler: Scheduler,
  reduced: boolean,
  random: () => number = Math.random,
  onDone: () => void = () => undefined,
): void {
  live.textContent = "";
  if (reduced) {
    live.textContent = text;
    onDone();
    return;
  }
  const chars = Array.from(text);
  let pending = chars.filter(isScrambled).length;
  if (pending === 0) onDone();
  const settle = (span: HTMLElement, char: string): void => {
    span.textContent = char;
    pending -= 1;
    if (pending === 0) onDone();
  };
  chars.forEach((char, index) => {
    const span = document.createElement("span");
    span.textContent = isScrambled(char) ? randomGlyph(random) : char;
    live.appendChild(span);
    if (!isScrambled(char)) return;
    const cycles = SCRAMBLE.baseCycles + Math.floor(random() * SCRAMBLE.cycleJitter);
    const step = SCRAMBLE.baseStepMs + Math.floor(random() * SCRAMBLE.stepJitterMs);
    let done = 0;
    const tick = (): void => {
      if (done >= cycles) {
        settle(span, char);
        return;
      }
      span.textContent = randomGlyph(random);
      done += 1;
      scheduler.later(tick, step);
    };
    scheduler.later(tick, index * SCRAMBLE.staggerMs);
  });
}
