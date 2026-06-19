import { StyleSheet, Text, View } from 'react-native';

import type { Bounds, MapCoordinateSystem, RouteNode } from '../shared';
import { worldMetersToPixels } from '../shared';

type NavigationNodeLayerProps = {
  origin: RouteNode | null;
  destination: RouteNode | null;
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

function labelFor(node: RouteNode): string {
  return (node.node_id ?? node.id ?? '?').replace(/^node_/, '');
}

function markerPosition(
  node: RouteNode,
  bounds: Bounds,
  coordinateSystem: MapCoordinateSystem,
) {
  const point = worldMetersToPixels(node.position, coordinateSystem);
  return {
    left: point.x - bounds.x - 14,
    top: point.y - bounds.y - 14,
  };
}

export function NavigationNodeLayer({
  origin,
  destination,
  bounds,
  coordinateSystem,
}: NavigationNodeLayerProps) {
  return (
    <>
      {origin ? (
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            styles.startMarker,
            markerPosition(origin, bounds, coordinateSystem),
          ]}
        >
          <Text style={styles.markerText}>S</Text>
          <Text style={[styles.caption, styles.startCaption]}>
            START · NODE {labelFor(origin)}
          </Text>
        </View>
      ) : null}
      {destination ? (
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            styles.destinationMarker,
            markerPosition(destination, bounds, coordinateSystem),
          ]}
        >
          <Text style={styles.markerText}>{labelFor(destination)}</Text>
          <Text style={[styles.caption, styles.destinationCaption]}>DESTINATION</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    zIndex: 19,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  startMarker: {
    backgroundColor: '#2f7d4b',
  },
  destinationMarker: {
    backgroundColor: '#f06419',
  },
  markerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  caption: {
    position: 'absolute',
    top: 30,
    width: 104,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: 'hidden',
    borderRadius: 5,
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
  },
  startCaption: {
    backgroundColor: 'rgba(30, 88, 51, 0.92)',
  },
  destinationCaption: {
    backgroundColor: 'rgba(182, 67, 10, 0.92)',
  },
});
