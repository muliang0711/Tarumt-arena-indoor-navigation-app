import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OverlayRouteNode, RoutePosition } from '../tiled/type';
import { findCurrentJunctionNode } from './junctionPositionModel';
import type {
  WrongWayRerouteConfig,
  WrongWayRerouteResult,
  WrongWayRerouteState,
} from './type';
import {
  createWrongWayRerouteState,
  evaluateWrongWayReroute,
} from './wrongWayRerouteModel';
import { DEFAULT_WRONG_WAY_REROUTE_CONFIG } from './wrongWayRerouteConfig';

type WrongWayRerouteMonitorInput = {
  acceptedExpectedHeadingDegrees?: readonly number[];
  config?: Partial<WrongWayRerouteConfig>;
  observedHeadingDegrees: number;
  routeNodes: readonly OverlayRouteNode[];
  routePosition: RoutePosition;
};

export function useWrongWayRerouteMonitor({
  acceptedExpectedHeadingDegrees,
  config: configOverride,
  observedHeadingDegrees,
  routeNodes,
  routePosition,
}: WrongWayRerouteMonitorInput) {
  const config = useMemo(
    (): WrongWayRerouteConfig => ({
      ...DEFAULT_WRONG_WAY_REROUTE_CONFIG,
      ...configOverride,
    }),
    [configOverride],
  );
  const stateRef = useRef<WrongWayRerouteState>(
    createWrongWayRerouteState(),
  );
  const observedHeadingDegreesRef = useRef(observedHeadingDegrees);
  const acceptedExpectedHeadingDegreesRef = useRef(
    acceptedExpectedHeadingDegrees,
  );
  const routeNodesRef = useRef(routeNodes);
  const routePositionRef = useRef(routePosition);
  const initialResult = useMemo(
    () =>
      evaluateWrongWayReroute({
        acceptedExpectedHeadingDegrees,
        config,
        currentNode: null,
        expectedHeadingDegrees: routePosition.headingDegrees,
        nowMs: Date.now(),
        observedHeadingDegrees,
        state: stateRef.current,
      }),
    [
      acceptedExpectedHeadingDegrees,
      config,
      observedHeadingDegrees,
      routePosition.headingDegrees,
    ],
  );
  const [result, setResult] =
    useState<WrongWayRerouteResult>(initialResult);

  useEffect(() => {
    observedHeadingDegreesRef.current = observedHeadingDegrees;
  }, [observedHeadingDegrees]);

  useEffect(() => {
    acceptedExpectedHeadingDegreesRef.current = acceptedExpectedHeadingDegrees;
  }, [acceptedExpectedHeadingDegrees]);

  useEffect(() => {
    routeNodesRef.current = routeNodes;
  }, [routeNodes]);

  useEffect(() => {
    routePositionRef.current = routePosition;
  }, [routePosition]);

  const runCheck = useCallback(() => {
    const latestRoutePosition = routePositionRef.current;
    const currentJunctionNode = findCurrentJunctionNode({
      config,
      position: latestRoutePosition,
      routeNodes: routeNodesRef.current,
    });
    const nextResult = evaluateWrongWayReroute({
      acceptedExpectedHeadingDegrees:
        acceptedExpectedHeadingDegreesRef.current,
      config,
      currentNode: currentJunctionNode,
      expectedHeadingDegrees: latestRoutePosition.headingDegrees,
      nowMs: Date.now(),
      observedHeadingDegrees: observedHeadingDegreesRef.current,
      state: stateRef.current,
    });

    stateRef.current = nextResult.state;
    setResult(nextResult);
  }, [config]);

  useEffect(() => {
    runCheck();

    const timer = setInterval(runCheck, config.wrongWayCheckIntervalMs);

    return () => clearInterval(timer);
  }, [config.wrongWayCheckIntervalMs, runCheck]);

  const reset = useCallback(() => {
    stateRef.current = createWrongWayRerouteState();
    setResult((currentResult) => ({
      ...currentResult,
      oppositeHeadingDurationMs: 0,
      shouldSuggestReroute: false,
      state: stateRef.current,
    }));
  }, []);

  return {
    reset,
    result,
  };
}
