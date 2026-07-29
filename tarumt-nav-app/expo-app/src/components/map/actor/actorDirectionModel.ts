export type ActorDirection = 'down' | 'left' | 'right' | 'up';

const DIRECTION_CENTER_DEGREES: Record<ActorDirection, number> = {
  down: 90,
  left: 180,
  right: 0,
  up: 270,
};

export function actorDirectionFromHeading(
  headingDegrees: number,
): ActorDirection {
  const normalizedHeading = ((headingDegrees % 360) + 360) % 360;

  if (normalizedHeading >= 315 || normalizedHeading < 45) {
    return 'right';
  }
  if (normalizedHeading < 135) {
    return 'down';
  }
  if (normalizedHeading < 225) {
    return 'left';
  }
  return 'up';
}

export function actorDirectionWithHysteresis(input: {
  currentDirection: ActorDirection;
  headingDegrees: number;
  hysteresisDegrees?: number;
}) {
  const hysteresisDegrees = Math.max(0, input.hysteresisDegrees ?? 10);
  const currentDirectionCenter =
    DIRECTION_CENTER_DEGREES[input.currentDirection];
  const distanceFromCurrentDirection = shortestAngleDistanceDegrees(
    input.headingDegrees,
    currentDirectionCenter,
  );

  return distanceFromCurrentDirection <= 45 + hysteresisDegrees
    ? input.currentDirection
    : actorDirectionFromHeading(input.headingDegrees);
}

function shortestAngleDistanceDegrees(from: number, to: number) {
  return Math.abs(((((to - from) % 360) + 540) % 360) - 180);
}
