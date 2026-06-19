import { StyleSheet, View } from 'react-native';

import type { Bounds, MapCoordinateSystem, Polygon } from '../shared';
import { worldMetersToPixels } from '../shared';

type WalkableAreaDebugLayerProps = {
  areas: readonly Polygon[];
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

function polygonFrame(polygon: Polygon, coordinateSystem: MapCoordinateSystem) {
  const pixels = polygon.map((point) => worldMetersToPixels(point, coordinateSystem));
  const xs = pixels.map((point) => point.x);
  const ys = pixels.map((point) => point.y);

  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function WalkableAreaDebugLayer({
  areas,
  bounds,
  coordinateSystem,
}: WalkableAreaDebugLayerProps) {
  return (
    <>
      {areas.map((area, index) => {
        const frame = polygonFrame(area, coordinateSystem);
        return (
          <View
            key={`walkable-${index}`}
            pointerEvents="none"
            style={[
              styles.area,
              {
                left: frame.left - bounds.x,
                top: frame.top - bounds.y,
                width: frame.width,
                height: frame.height,
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  area: {
    position: 'absolute',
    zIndex: 18,
    backgroundColor: 'rgba(80, 120, 71, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(80, 120, 71, 0.45)',
  },
});
