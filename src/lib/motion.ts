export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
export const MOBILE_MAX_WIDTH = 639.98;

export function prefersReducedMotion(): boolean {
  return matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function isFinePointer(): boolean {
  return matchMedia(FINE_POINTER_QUERY).matches;
}
