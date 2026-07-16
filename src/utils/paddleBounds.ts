/** Clamp paddle origin on its movable axis so the full paddle stays inside the court. */
export function clampPaddleOrigin(
  origin: number,
  courtSpan: number,
  paddleLength: number,
  padding: number,
): number {
  const min = padding;
  const max = Math.max(min, courtSpan - paddleLength - padding);
  return Math.max(min, Math.min(max, origin));
}
