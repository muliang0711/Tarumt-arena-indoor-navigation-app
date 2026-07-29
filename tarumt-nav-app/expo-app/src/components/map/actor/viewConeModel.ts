export type ViewConeGeometry = {
  path: string;
  size: number;
};

export function createViewConeGeometry(input: {
  fieldOfViewDegrees: number;
  length: number;
}): ViewConeGeometry {
  const length = Math.max(1, input.length);
  const fieldOfViewDegrees = Math.min(
    179,
    Math.max(1, input.fieldOfViewDegrees),
  );
  const center = length;
  const halfAngleRadians = (fieldOfViewDegrees / 2) * (Math.PI / 180);
  const startX = center + length * Math.cos(-halfAngleRadians);
  const startY = center + length * Math.sin(-halfAngleRadians);
  const endX = center + length * Math.cos(halfAngleRadians);
  const endY = center + length * Math.sin(halfAngleRadians);

  return {
    path: [
      `M ${formatCoordinate(center)} ${formatCoordinate(center)}`,
      `L ${formatCoordinate(startX)} ${formatCoordinate(startY)}`,
      `A ${formatCoordinate(length)} ${formatCoordinate(length)} 0 0 1`,
      `${formatCoordinate(endX)} ${formatCoordinate(endY)}`,
      'Z',
    ].join(' '),
    size: length * 2,
  };
}

function formatCoordinate(value: number) {
  return Number(value.toFixed(3));
}
