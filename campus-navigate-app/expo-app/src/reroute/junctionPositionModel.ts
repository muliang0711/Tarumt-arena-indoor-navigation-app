import type { OverlayRouteNode, RoutePosition } from '../tiled/type';
import type { WrongWayRerouteConfig } from './type';

export function findCurrentJunctionNode(input: {
  config: WrongWayRerouteConfig;
  position: RoutePosition;
  routeNodes: readonly OverlayRouteNode[];
}) {
  const nearestJunction = input.routeNodes
    .filter((node) => isJunctionNodeType({ config: input.config, node }))
    .map((node) => ({
      distancePixels: Math.hypot(
        node.screenX - input.position.screenX,
        node.screenY - input.position.screenY,
      ),
      node,
    }))
    .sort((left, right) => left.distancePixels - right.distancePixels)[0];

  if (
    !nearestJunction ||
    nearestJunction.distancePixels > input.config.junctionCaptureRadiusPixels
  ) {
    return null;
  }

  return nearestJunction.node;
}

export function isJunctionNodeType(input: {
  config: WrongWayRerouteConfig;
  node: Pick<OverlayRouteNode, 'type'>;
}) {
  return (
    input.node.type.trim().toLowerCase() ===
    input.config.junctionNodeType.trim().toLowerCase()
  );
}
