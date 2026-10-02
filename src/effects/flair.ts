// REQ-005: pointer-tracking fill on the Portfolio pill (timings are the design motion tokens).
export const FLAIR_SCALE = 2.2;
const IN = "translate 350ms var(--ease-out-cubic), scale 450ms cubic-bezier(.25, .46, .45, .94)";
const OUT = "translate 350ms var(--ease-out-cubic), scale 350ms cubic-bezier(.25, .46, .45, .94)";

export function flairDiameter(width: number, height: number): number {
  return FLAIR_SCALE * Math.hypot(width, height);
}

export function mountFlair(pill: HTMLElement): void {
  const flair = document.createElement("span");
  flair.className = "flair";
  flair.setAttribute("aria-hidden", "true");
  pill.prepend(flair);
  document.documentElement.classList.add("has-flair");
  let diameter = 0;

  const moveTo = (event: PointerEvent): void => {
    const rect = pill.getBoundingClientRect();
    flair.style.translate = `${event.clientX - rect.left - diameter / 2}px ${event.clientY - rect.top - diameter / 2}px`;
  };

  pill.addEventListener("pointerenter", (event) => {
    const rect = pill.getBoundingClientRect();
    diameter = flairDiameter(rect.width, rect.height);
    flair.style.width = `${diameter}px`;
    flair.style.height = `${diameter}px`;
    flair.style.transition = "none";
    moveTo(event);
    flair.getBoundingClientRect(); // commit start position before animating scale
    flair.style.transition = IN;
    flair.style.scale = "1";
  });
  pill.addEventListener("pointermove", moveTo);
  pill.addEventListener("pointerleave", (event) => {
    flair.style.transition = OUT;
    moveTo(event);
    flair.style.scale = "0";
  });
}
