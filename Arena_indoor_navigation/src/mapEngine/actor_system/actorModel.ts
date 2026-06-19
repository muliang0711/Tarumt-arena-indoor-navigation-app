import type { MapCoordinateSystem, MovementRouteGraph, WorldPosition } from '../shared';
import { worldMetersToPixels } from '../shared';

export type Actor = {
  id: string;
  name: string;
  nodeId: string;
  position: WorldPosition;
  direction: 'down' | 'left' | 'right' | 'up';
  action: 'idle' | 'run';
};

type RouteGraphMap = {
  movement: {
    routeGraph: MovementRouteGraph;
  };
};

export function buildBobActorAtNode(mapData: RouteGraphMap, nodeId = 'node_1'): Actor {
  const node = mapData.movement.routeGraph.nodes.find((item) => item.node_id === nodeId || item.id === nodeId);
  if (!node) {
    throw new Error(`Route node "${nodeId}" was not found.`);
  }

  return {
    id: 'bob',
    name: 'Bob',
    nodeId,
    position: { x: node.position.x, y: node.position.y },
    direction: 'down',
    action: 'idle',
  };
}

export function routeNodeToPixels(
  actor: Pick<Actor, 'position'>,
  coordinateSystem: MapCoordinateSystem,
) {
  const point = worldMetersToPixels(actor.position, coordinateSystem);
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}
