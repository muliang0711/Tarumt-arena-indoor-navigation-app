export function fanRotationDegrees(headingRadians: number): number {
  const degrees = ((headingRadians * 180) / Math.PI + 90) % 360;
  return degrees < 0 ? degrees + 360 : degrees;
}
