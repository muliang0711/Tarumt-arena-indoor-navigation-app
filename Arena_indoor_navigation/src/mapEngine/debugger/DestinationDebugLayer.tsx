import { StyleSheet, Text, View } from 'react-native';

import type {
  Bounds,
  MapCoordinateSystem,
  RouteNode,
} from '../shared';
import { worldMetersToPixels } from '../shared';

type DestinationDebugLayerProps = {
  destination: RouteNode | null;
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

const MARKER_SIZE = 30;

export function DestinationDebugLayer({
  destination,
  bounds,
  coordinateSystem,
}: DestinationDebugLayerProps) {
  if (!destination) {
    return null;
  }

  const point = worldMetersToPixels(destination.position, coordinateSystem);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.marker,
        {
          left: point.x - bounds.x - MARKER_SIZE / 2,
          top: point.y - bounds.y - MARKER_SIZE,
        },
      ]}
    >
      <Text style={styles.markerText}>4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    zIndex: 19,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#ff7417',
  },
  markerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
