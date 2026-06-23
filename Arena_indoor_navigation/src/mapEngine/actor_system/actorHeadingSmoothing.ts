const FULL_TURN = Math.PI * 2;

export function normalizeHeading(radians: number): number {
  if (!Number.isFinite(radians)) {
    return 0;
  }
  const wrapped = radians % FULL_TURN;
  const normalized = wrapped >= 0 ? wrapped : wrapped + FULL_TURN;
  return normalized < 1e-12 || FULL_TURN - normalized < 1e-12
    ? 0
    : normalized;
}

export function shortestHeadingDelta(from: number, to: number): number {
  const delta = normalizeHeading(to) - normalizeHeading(from);
  return (
    ((delta + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI
  );
}

export function stepHeadingToward(
  current: number,
  target: number,
  maximumDelta: number,
): number {
  if (!Number.isFinite(maximumDelta) || maximumDelta <= 0) {
    return normalizeHeading(target);
  }
  const delta = shortestHeadingDelta(current, target);
  if (Math.abs(delta) <= maximumDelta) {
    return normalizeHeading(target);
  }
  return normalizeHeading(current + Math.sign(delta) * maximumDelta);
}
