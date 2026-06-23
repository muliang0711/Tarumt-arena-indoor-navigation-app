import {
  deriveActorDirectionFromHeading,
  type ActorDirection,
} from './actorModel';

export function fanRotationDegrees(headingRadians: number): number {
  const degrees = ((headingRadians * 180) / Math.PI + 90) % 360;
  return degrees < 0 ? degrees + 360 : degrees;
}

export function deriveActorVisualFacing(
  headingRadians: number,
  fallbackDirection: ActorDirection,
): {
  direction: ActorDirection;
  fanRotationDegrees: number;
} {
  return {
    direction: deriveActorDirectionFromHeading(
      headingRadians,
      fallbackDirection,
    ),
    fanRotationDegrees: fanRotationDegrees(headingRadians),
  };
}
