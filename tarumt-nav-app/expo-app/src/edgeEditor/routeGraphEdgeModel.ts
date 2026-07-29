import type { OverlayPathSegment, OverlayRouteNode } from '../tiled/type';

export type EdgeFieldDraft = {
  key: string;
  value: string;
};

export type RouteGraphEdgeExportValue = boolean | number | string;

export type RouteGraphEdgeExport = {
  distance: number;
  from: string;
  id: string;
  to: string;
} & Record<string, RouteGraphEdgeExportValue>;

export type RouteGraphEdgeDocument = {
  edges: RouteGraphEdgeExport[];
  kind: 'route-graph-edges';
  sourceMap: string;
  version: 1;
};

export type CreateRouteGraphEdgeInput = {
  distance: number;
  fields: EdgeFieldDraft[];
  from: string;
  id: string;
  to: string;
};

const RESERVED_EDGE_KEYS = new Set(['id', 'from', 'to', 'distance']);

export function createRouteGraphEdge({
  distance,
  fields,
  from,
  id,
  to,
}: CreateRouteGraphEdgeInput): RouteGraphEdgeExport {
  const edge: RouteGraphEdgeExport = {
    distance: roundDistance(distance),
    from,
    id: id.trim(),
    to,
  };

  fields.forEach((field) => {
    const key = field.key.trim();
    if (!key || RESERVED_EDGE_KEYS.has(key)) {
      return;
    }

    edge[key] = parseEdgeFieldValue(field.value);
  });

  return edge;
}

export function createRouteGraphEdgeDocument(
  edges: RouteGraphEdgeExport[],
  sourceMap: string,
): RouteGraphEdgeDocument {
  return {
    edges,
    kind: 'route-graph-edges',
    sourceMap,
    version: 1,
  };
}

export function stringifyRouteGraphEdgeDocument(
  edges: RouteGraphEdgeExport[],
  sourceMap: string,
) {
  return `${JSON.stringify(createRouteGraphEdgeDocument(edges, sourceMap), null, 2)}\n`;
}

export function createEdgePathSegments(
  edges: RouteGraphEdgeExport[],
  nodes: OverlayRouteNode[],
): OverlayPathSegment[] {
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));

  return edges.flatMap((edge) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) {
      return [];
    }

    return [createEdgePathSegment(edge.id, from, to)];
  });
}

export function createNodeDistance(from: OverlayRouteNode, to: OverlayRouteNode) {
  return roundDistance(
    Math.hypot(to.screenX - from.screenX, to.screenY - from.screenY),
  );
}

export function parseEdgeFieldValue(value: string): RouteGraphEdgeExportValue {
  const trimmedValue = value.trim();

  if (trimmedValue === 'true') {
    return true;
  }

  if (trimmedValue === 'false') {
    return false;
  }

  if (trimmedValue !== '' && Number.isFinite(Number(trimmedValue))) {
    return Number(trimmedValue);
  }

  return value;
}

function createEdgePathSegment(
  key: string,
  from: OverlayRouteNode,
  to: OverlayRouteNode,
): OverlayPathSegment {
  const deltaX = to.screenX - from.screenX;
  const deltaY = to.screenY - from.screenY;

  return {
    fromNodeId: from.nodeId,
    key,
    length: Math.hypot(deltaX, deltaY),
    rotationDegrees: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
    toNodeId: to.nodeId,
    x: from.screenX,
    y: from.screenY,
  };
}

function roundDistance(distance: number) {
  return Math.round(distance * 100) / 100;
}
