import type { MapCoordinateSystem, MovementRouteGraph, WorldPosition } from '../shared';
import { worldMetersToPixels } from '../shared';

export type ActorDirection = 'down' | 'left' | 'right' | 'up';
export type ActorAction = 'idle' | 'run';

export type Actor = {
  id: string;
  name: string;
  nodeId: string;
  position: WorldPosition;
  direction: ActorDirection;
  action: ActorAction;
  label?: string;
  headingRadians?: number | null;
  isUser?: boolean;
};

const MOVEMENT_EPSILON = 0.001;

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
    x: Number(point.x.toFixed(4)),
    y: Number(point.y.toFixed(4)),
  };
}

export function deriveActorMotionState(
  actor: Pick<Actor, 'direction'>,
  delta: WorldPosition,
): Pick<Actor, 'direction' | 'action'> {
  const magnitude = Math.hypot(delta.x, delta.y);
  if (magnitude < MOVEMENT_EPSILON) {
    return {
      direction: actor.direction,
      action: 'idle',
    };
  }

  if (Math.abs(delta.x) > Math.abs(delta.y)) {
    return {
      direction: delta.x >= 0 ? 'right' : 'left',
      action: 'run',
    };
  }

  return {
    direction: delta.y >= 0 ? 'down' : 'up',
    action: 'run',
  };
}
