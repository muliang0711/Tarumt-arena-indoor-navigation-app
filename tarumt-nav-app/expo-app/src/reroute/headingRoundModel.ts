import { normalizeDegrees } from '../pdr/model';

export function roundHeadingDegrees(input: {
  headingDegrees: number;
  roundDegrees: number;
}) {
  if (input.roundDegrees <= 0) {
    return normalizeDegrees(input.headingDegrees);
  }

  return normalizeDegrees(
    Math.round(input.headingDegrees / input.roundDegrees) * input.roundDegrees,
  );
}
