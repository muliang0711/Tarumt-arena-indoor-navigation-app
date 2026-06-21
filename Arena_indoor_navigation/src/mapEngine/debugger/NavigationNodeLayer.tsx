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
    left: point.x - bounds.x - 17,
    top: point.y - bounds.y - 17,
  };
}

export function NavigationNodeLayer({
  origin: _origin,
  destination,
  bounds,
  coordinateSystem,
}: NavigationNodeLayerProps) {
  return destination ? (
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
  ) : null;
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    zIndex: 19,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  destinationMarker: {
    backgroundColor: '#f06419',
  },
  markerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  caption: {
    position: 'absolute',
    top: 36,
    width: 118,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  destinationCaption: {
    backgroundColor: 'rgba(182, 67, 10, 0.92)',
  },
});
