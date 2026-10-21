// How much a signature pad has actually drawn, so a stray tap does not count as a signature.
//
// A tap fires touch-down with little or no movement, which leaves a speck on the canvas. The pad used to
// count that as signed, which let "Sign Document" submit a near-blank image (a customer's acceptance came
// through as two dots). Ink is measured as the length of the line drawn, in CSS pixels, across all strokes.

/** The least line length that counts as a signature. A short initial is well over this; a tap is near 0. */
export const MIN_SIGNATURE_INK = 40;

export interface InkPoint {
  x: number;
  y: number;
}

/** The ink after drawing from one point to the next. */
export function addInk(total: number, from: InkPoint, to: InkPoint): number {
  return total + Math.hypot(to.x - from.x, to.y - from.y);
}

/** True once enough has been drawn to count as a signature. */
export function hasEnoughInk(total: number): boolean {
  return total >= MIN_SIGNATURE_INK;
}
