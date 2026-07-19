import type { RoutePosition } from '../tiled/type';
import type { DerivedEstimateSource, DerivedNavigationEstimate } from './type';

export const DEBUG_REPLAY_SOURCE: DerivedEstimateSource = {
  kind: 'debug-replay',
  name: 'Debug replay derived estimate',
};

export function createDebugReplayEstimate(input: {
  nowMs: number;
  routePosition: RoutePosition;
  sequenceIndex: number;
}): DerivedNavigationEstimate {
  const offset = getReplayOffset(input.sequenceIndex);

  return {
    confidence: 0.76,
    headingDegrees: input.routePosition.headingDegrees,
    source: DEBUG_REPLAY_SOURCE.kind,
    timestampMs: input.nowMs,
    x: input.routePosition.screenX + offset.x,
    y: input.routePosition.screenY + offset.y,
  };
}

function getReplayOffset(sequenceIndex: number) {
  const replayOffsets = [
    { x: 28, y: 26 },
    { x: 48, y: 22 },
    { x: 68, y: 18 },
    { x: 90, y: 14 },
    { x: 112, y: 10 },
  ] as const;
  const fallbackOffset = replayOffsets[0];

  return replayOffsets[sequenceIndex % replayOffsets.length] ?? fallbackOffset;
}
