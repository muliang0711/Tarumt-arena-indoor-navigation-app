import { useMemo, useState } from 'react';

import type { RedMarkerState, RoutePosition, SurfaceRect } from '../tiled/type';
import { createDebugReplayEstimate } from './debugReplayEstimateModel';
import {
  createDerivedEstimateBuffer,
  getLatestDerivedEstimate,
  ingestDerivedEstimate,
} from './derivedEstimateBufferModel';
import { redMarkerFromDerivedEstimate } from './derivedEstimateMarkerModel';
import type {
  DerivedEstimateBuffer,
  DerivedEstimateIngestResult,
  DerivedNavigationEstimate,
} from './type';

type DerivedEstimateBridgeInput = {
  initialRedMarker: RedMarkerState;
  routePosition: RoutePosition;
  surface: SurfaceRect;
};

type DerivedEstimateBridgeState = {
  buffer: DerivedEstimateBuffer;
  lastResult: DerivedEstimateIngestResult | null;
};

export function useDerivedEstimateBridge({
  initialRedMarker,
  routePosition,
  surface,
}: DerivedEstimateBridgeInput) {
  const [bridgeState, setBridgeState] = useState<DerivedEstimateBridgeState>(
    () => ({
      buffer: createDerivedEstimateBuffer(),
      lastResult: null,
    }),
  );
  const [replaySequenceIndex, setReplaySequenceIndex] = useState(0);
  const [headingOnlyDegrees, setHeadingOnlyDegrees] = useState<number | null>(
    null,
  );
  const latestEstimate = getLatestDerivedEstimate(bridgeState.buffer);
  const observedHeadingDegrees =
    headingOnlyDegrees ?? latestEstimate?.headingDegrees ?? null;
  const redMarker = useMemo(
    () => {
      const marker = latestEstimate
        ? redMarkerFromDerivedEstimate(latestEstimate, surface)
        : initialRedMarker;

      return headingOnlyDegrees === null
        ? marker
        : {
            ...marker,
            headingDegrees: headingOnlyDegrees,
          };
    },
    [headingOnlyDegrees, initialRedMarker, latestEstimate, surface],
  );

  function ingestExternalEstimate(estimate: DerivedNavigationEstimate) {
    setBridgeState((currentState) => {
      const result = ingestDerivedEstimate({
        buffer: currentState.buffer,
        estimate,
      });

      return {
        buffer: result.buffer,
        lastResult: result,
      };
    });
  }

  function runReplayStep() {
    const nowMs = Date.now();
    ingestExternalEstimate(
      createDebugReplayEstimate({
        nowMs,
        routePosition,
        sequenceIndex: replaySequenceIndex,
      }),
    );
    setReplaySequenceIndex((currentIndex) => currentIndex + 1);
  }

  function reset() {
    setBridgeState({
      buffer: createDerivedEstimateBuffer(),
      lastResult: null,
    });
    setHeadingOnlyDegrees(null);
    setReplaySequenceIndex(0);
  }

  return {
    buffer: bridgeState.buffer,
    ingestExternalEstimate,
    lastResult: bridgeState.lastResult,
    latestEstimate,
    observedHeadingDegrees,
    redMarker,
    reset,
    runReplayStep,
    updateHeadingOnly: setHeadingOnlyDegrees,
  };
}
