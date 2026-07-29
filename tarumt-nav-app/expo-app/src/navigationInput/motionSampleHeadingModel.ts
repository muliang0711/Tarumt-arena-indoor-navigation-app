import type { MotionInputSample } from '../pdr';

export function applyLiveHeadingToMotionSample(input: {
  liveHeadingDegrees: number | null;
  sample: MotionInputSample;
}): MotionInputSample {
  if (input.liveHeadingDegrees === null) {
    return input.sample;
  }

  return {
    ...input.sample,
    headingDegrees: input.liveHeadingDegrees,
  };
}
