import type { WrongWayRerouteConfig } from './type';

export function isHeadingOutsideAllowedDeviation(input: {
  config: WrongWayRerouteConfig;
  expectedHeadingDegrees: number;
  observedHeadingDegrees: number;
}) {
  return (
    shortestAngleDistanceDegrees(
      input.expectedHeadingDegrees,
      input.observedHeadingDegrees,
    ) >= input.config.allowedHeadingDeviationDegrees
  );
}

export function isOppositeHeading(input: {
  config: WrongWayRerouteConfig;
  expectedHeadingDegrees: number;
  observedHeadingDegrees: number;
}) {
  return isHeadingOutsideAllowedDeviation(input);
}

function shortestAngleDistanceDegrees(from: number, to: number) {
  const difference = Math.abs(normalizeDegrees(from) - normalizeDegrees(to));
  return Math.min(difference, 360 - difference);
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}
