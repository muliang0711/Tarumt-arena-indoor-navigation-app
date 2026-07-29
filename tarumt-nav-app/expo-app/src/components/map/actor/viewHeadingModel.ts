export function closestViewHeadingTarget(
  currentHeading: number,
  nextHeading: number,
) {
  const delta = ((((nextHeading - currentHeading) % 360) + 540) % 360) - 180;
  return currentHeading + delta;
}

export function resolveUserFacingHeadingDegrees(input: {
  lastObservedHeadingDegrees: number;
  observedHeadingDegrees?: number | null;
}) {
  return input.observedHeadingDegrees ?? input.lastObservedHeadingDegrees;
}
