import { StyleSheet, Text, View } from 'react-native';

import type {
  Bounds,
  MapCoordinateSystem,
  MovementRouteGraph,
  RouteNode,
} from '../shared';
import { worldMetersToPixels } from '../shared';
import type { HighlightedRoute } from './navigationDebugModel';

type RouteDebugLayerProps = {
  route: HighlightedRoute | null;
  routeGraph: MovementRouteGraph;
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

const ROUTE_START_OFFSET_PX = 22;

function nodeId(node: RouteNode): string | null {
  return node.node_id ?? node.id ?? null;
}

export function RouteDebugLayer({
  route,
  routeGraph,
  bounds,
  coordinateSystem,
}: RouteDebugLayerProps) {
  if (!route) {
    return null;
  }
  const nodes = new Map(
    routeGraph.nodes.flatMap((node) => {
      const id = nodeId(node);
      return id ? [[id, node] as const] : [];
    }),
  );

  return (
    <>
      {route.edges.map((edge, index) => {
        const from = nodes.get(route.nodeIds[index]);
        const to = nodes.get(route.nodeIds[index + 1]);
        if (!from || !to) {
          return null;
        }
        const fromPoint = worldMetersToPixels(from.position, coordinateSystem);
        const toPoint = worldMetersToPixels(to.position, coordinateSystem);
        const segmentStart =
          index === 0
            ? offsetRouteStartPoint(fromPoint, toPoint, ROUTE_START_OFFSET_PX)
            : fromPoint;
        const dx = toPoint.x - segmentStart.x;
        const dy = toPoint.y - segmentStart.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        return (
          <View
            key={edge.edge_id ?? edge.id ?? `${route.nodeIds[index]}-${route.nodeIds[index + 1]}`}
            pointerEvents="none"
            style={[
              styles.routeShadow,
              {
                left: (segmentStart.x + toPoint.x) / 2 - bounds.x - length / 2,
                top: (segmentStart.y + toPoint.y) / 2 - bounds.y - 6,
                width: length,
                transform: [{ rotate: `${angle}rad` }],
              },
            ]}
          >
            <View style={styles.routeCore} />
            <View style={styles.arrowRow}>
              {Array.from({ length: Math.max(1, Math.floor(length / 38)) }).map((_, arrowIndex) => (
                <Text key={arrowIndex} style={styles.arrowText}>
                  ›
                </Text>
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}

function offsetRouteStartPoint(fromPoint: { x: number; y: number }, toPoint: { x: number; y: number }, distancePx: number) {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const length = Math.hypot(dx, dy);
  if (length <= distancePx || length === 0) {
    return fromPoint;
  }

  return {
    x: fromPoint.x + (dx / length) * distancePx,
    y: fromPoint.y + (dy / length) * distancePx,
  };
}

const styles = StyleSheet.create({
  routeShadow: {
    position: 'absolute',
    zIndex: 18,
    height: 12,
    padding: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  routeCore: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#1479d1',
  },
  arrowRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  arrowText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 13,
  },
});
