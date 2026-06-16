import { NormalizedMapSchema } from '../map_rendering_system/mapRendererModel';

export type Actor = {
  id: string;
  name: string;
  nodeId: string;
  position: {
    x: number;
    y: number;
  };
  direction: 'down' | 'left' | 'right' | 'up';
  action: 'idle' | 'run';
};

export function buildBobActorAtNode(mapData: NormalizedMapSchema, nodeId = 'node_1'): Actor {
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

export function routeNodeToPixels(actor: Pick<Actor, 'position'>, pixelsPerMeter: number) {
  return {
    x: Math.round(actor.position.x * pixelsPerMeter),
    y: Math.round(actor.position.y * pixelsPerMeter),
  };
}
