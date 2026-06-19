import { StyleSheet, View } from 'react-native';

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
        const dx = toPoint.x - fromPoint.x;
        const dy = toPoint.y - fromPoint.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        return (
          <View
            key={edge.edge_id ?? edge.id ?? `${route.nodeIds[index]}-${route.nodeIds[index + 1]}`}
            pointerEvents="none"
            style={[
              styles.routeShadow,
              {
                left: (fromPoint.x + toPoint.x) / 2 - bounds.x - length / 2,
                top: (fromPoint.y + toPoint.y) / 2 - bounds.y - 4,
                width: length,
                transform: [{ rotate: `${angle}rad` }],
              },
            ]}
          >
            <View style={styles.routeCore} />
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  routeShadow: {
    position: 'absolute',
    zIndex: 18,
    height: 8,
    padding: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  routeCore: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: '#1479d1',
  },
});
