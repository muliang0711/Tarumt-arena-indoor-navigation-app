import { useEffect, useMemo, useState } from 'react';

import {
  calculateRouteDistance,
  createRemainingRouteSegments,
  interpolateRoutePosition,
} from '../tiled/model';
import type { OverlayPoint } from '../tiled/type';
import type { SimulationStatus } from './type';

const SIMULATION_STEP_PIXELS = 96;
const SIMULATION_SPEED_PIXELS_PER_SECOND = 140;
const SIMULATION_TICK_MS = 100;

export function useRouteSimulation(routePath: readonly OverlayPoint[]) {
  const [status, setStatus] = useState<SimulationStatus>('ready');
  const [routeProgressPixels, setRouteProgressPixels] = useState(0);

  const routeDistancePixels = useMemo(
    () => calculateRouteDistance(routePath),
    [routePath],
  );
  const blueMarkerPosition = useMemo(
    () => interpolateRoutePosition(routePath, routeProgressPixels),
    [routePath, routeProgressPixels],
  );
  const remainingPathSegments = useMemo(
    () => createRemainingRouteSegments(routePath, routeProgressPixels),
    [routePath, routeProgressPixels],
  );
  const distanceRemainingPixels = Math.max(
    0,
    routeDistancePixels - routeProgressPixels,
  );

  useEffect(() => {
    if (status !== 'moving') {
      return;
    }

    const timer = setInterval(() => {
      setRouteProgressPixels((currentProgress) => {
        const nextProgress = Math.min(
          routeDistancePixels,
          currentProgress +
            (SIMULATION_SPEED_PIXELS_PER_SECOND * SIMULATION_TICK_MS) / 1000,
        );
        if (nextProgress >= routeDistancePixels) {
          setStatus('arrived');
        }
        return nextProgress;
      });
    }, SIMULATION_TICK_MS);

    return () => clearInterval(timer);
  }, [routeDistancePixels, status]);

  function start() {
    if (routeProgressPixels >= routeDistancePixels) {
      setRouteProgressPixels(0);
    }
    setStatus('moving');
  }

  function pause() {
    setStatus((currentStatus) =>
      currentStatus === 'arrived' ? currentStatus : 'paused',
    );
  }

  function reset() {
    setRouteProgressPixels(0);
    setStatus('ready');
  }

  function stepForward() {
    setRouteProgressPixels((currentProgress) => {
      const nextProgress = Math.min(
        routeDistancePixels,
        currentProgress + SIMULATION_STEP_PIXELS,
      );
      setStatus(nextProgress >= routeDistancePixels ? 'arrived' : 'paused');
      return nextProgress;
    });
  }

  return {
    blueMarkerPosition,
    distanceRemainingPixels,
    pause,
    remainingPathSegments,
    reset,
    routeDistancePixels,
    routeProgressPixels,
    start,
    status,
    stepForward,
  };
}
