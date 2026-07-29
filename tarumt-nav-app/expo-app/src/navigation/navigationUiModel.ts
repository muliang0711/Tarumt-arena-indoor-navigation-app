import type { OverlayRouteNode, RoutePosition } from '../tiled/type';
import type { SimulationStatus } from '../simulation/type';
import type { NavigationTurn, NavigationUiState } from './type';

export function createNavigationUiState(input: {
  distanceRemainingPixels: number;
  routeDistancePixels: number;
  routePath: readonly OverlayRouteNode[];
  routePosition: RoutePosition;
  status: SimulationStatus;
}): NavigationUiState {
  return {
    currentSegment: getCurrentSegmentLabel(
      input.routePath,
      input.routePosition.segmentIndex,
    ),
    distanceRemainingPixels: input.distanceRemainingPixels,
    instruction: getNavigationInstruction(
      input.routePath,
      input.routePosition.segmentIndex,
      input.status,
    ),
    progressPercent:
      input.routeDistancePixels === 0
        ? 0
        : Math.min(
            100,
            Math.max(
              0,
              (input.routePosition.distanceAlongRoute /
                input.routeDistancePixels) *
                100,
            ),
          ),
    status: input.status,
  };
}

export function getCurrentSegmentLabel(
  routePath: readonly OverlayRouteNode[],
  segmentIndex: number,
) {
  const from = routePath[segmentIndex];
  const to = routePath[segmentIndex + 1];

  if (!from || !to) {
    return 'Arrived';
  }

  return `${from.nodeId} -> ${to.nodeId}`;
}

export function getNavigationInstruction(
  routePath: readonly OverlayRouteNode[],
  segmentIndex: number,
  status: SimulationStatus,
): NavigationTurn {
  if (status === 'arrived' || segmentIndex >= routePath.length - 1) {
    return 'arrived';
  }

  const currentFrom = routePath[segmentIndex];
  const currentTo = routePath[segmentIndex + 1];
  const nextTo = routePath[segmentIndex + 2];
  if (!currentFrom || !currentTo || !nextTo) {
    return 'straight';
  }

  const currentVector = {
    x: currentTo.screenX - currentFrom.screenX,
    y: currentTo.screenY - currentFrom.screenY,
  };
  const nextVector = {
    x: nextTo.screenX - currentTo.screenX,
    y: nextTo.screenY - currentTo.screenY,
  };
  const cross = currentVector.x * nextVector.y - currentVector.y * nextVector.x;

  if (Math.abs(cross) < 0.001) {
    return 'straight';
  }

  return cross > 0 ? 'right' : 'left';
}

export function formatNavigationInstruction(instruction: NavigationTurn) {
  switch (instruction) {
    case 'left':
      return 'Turn left';
    case 'right':
      return 'Turn right';
    case 'arrived':
      return 'Arrived';
    case 'straight':
    default:
      return 'Continue straight';
  }
}
