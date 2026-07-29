import type { MotionInputSample } from '../type';

export function createMockMotionBatch(input: {
  desiredHeadingDegrees: number;
  nowMs: number;
}) {
  const headings = [
    input.desiredHeadingDegrees - 6,
    input.desiredHeadingDegrees + 4,
    input.desiredHeadingDegrees + 9,
    input.desiredHeadingDegrees - 3,
  ];

  return headings.map(
    (headingDegrees, index): MotionInputSample => ({
      acceleration: {
        x: index === 1 ? 0.4 : 1.45,
        y: 0,
        z: 0,
      },
      headingDegrees,
      timestampMs: input.nowMs - (headings.length - index) * 18,
    }),
  );
}
