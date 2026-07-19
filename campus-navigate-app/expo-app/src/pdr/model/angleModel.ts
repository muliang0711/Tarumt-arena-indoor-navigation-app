export function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function shortestAngleDistanceDegrees(from: number, to: number) {
  const difference = Math.abs(normalizeDegrees(from) - normalizeDegrees(to));
  return Math.min(difference, 360 - difference);
}

export function circularMeanDegrees(degrees: readonly number[]) {
  if (degrees.length === 0) {
    return 0;
  }

  const vector = degrees.reduce(
    (current, heading) => {
      const radians = (normalizeDegrees(heading) * Math.PI) / 180;
      return {
        x: current.x + Math.cos(radians),
        y: current.y + Math.sin(radians),
      };
    },
    { x: 0, y: 0 },
  );

  return normalizeDegrees((Math.atan2(vector.y, vector.x) * 180) / Math.PI);
}
