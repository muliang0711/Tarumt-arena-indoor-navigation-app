import { StyleSheet, View } from 'react-native';

import type { Bounds, MapCoordinateSystem, Point, Polygon } from '../shared';
import { worldMetersToPixels } from '../shared';
import type {
  UnwalkableOverlayModel,
  WorldRectangle,
} from './unwalkableOverlayModel';

type UnwalkableAreaDebugLayerProps = {
  model: UnwalkableOverlayModel;
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

function rectangleFrame(
  rectangle: WorldRectangle,
  coordinateSystem: MapCoordinateSystem,
) {
  const topLeft = worldMetersToPixels(rectangle, coordinateSystem);
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: rectangle.width * coordinateSystem.pixelsPerMeter,
    height: rectangle.height * coordinateSystem.pixelsPerMeter,
  };
}

function polygonFrame(polygon: Polygon, coordinateSystem: MapCoordinateSystem) {
  const points = polygon.map((point) => worldMetersToPixels(point, coordinateSystem));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function lineFrame(
  from: Point,
  to: Point,
  coordinateSystem: MapCoordinateSystem,
) {
  const start = worldMetersToPixels(from, coordinateSystem);
  const end = worldMetersToPixels(to, coordinateSystem);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return {
    left: (start.x + end.x) / 2 - length / 2,
    top: (start.y + end.y) / 2 - 2,
    width: length,
    transform: [{ rotate: `${Math.atan2(end.y - start.y, end.x - start.x)}rad` }],
  };
}

export function UnwalkableAreaDebugLayer({
  model,
  bounds,
  coordinateSystem,
}: UnwalkableAreaDebugLayerProps) {
  return (
    <>
      {model.mergedRectangles.map((rectangle, index) => {
        const frame = rectangleFrame(rectangle, coordinateSystem);
        return (
          <View
            key={`outside-${index}`}
            pointerEvents="none"
            style={[
              styles.outsideArea,
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
      {model.blockedAreas.map((polygon, index) => {
        const frame = polygonFrame(polygon, coordinateSystem);
        return (
          <View
            key={`blocked-${index}`}
            pointerEvents="none"
            style={[
              styles.blockedArea,
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
      {model.walls.map((wall, index) => {
        const frame = lineFrame(wall.from, wall.to, coordinateSystem);
        return (
          <View
            key={`wall-${index}`}
            pointerEvents="none"
            style={[
              styles.wall,
              {
                left: frame.left - bounds.x,
                top: frame.top - bounds.y,
                width: frame.width,
                transform: frame.transform,
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  outsideArea: {
    position: 'absolute',
    zIndex: 16,
    backgroundColor: 'rgba(211, 35, 35, 0.22)',
  },
  blockedArea: {
    position: 'absolute',
    zIndex: 17,
    borderWidth: 1,
    borderColor: 'rgba(139, 0, 0, 0.82)',
    backgroundColor: 'rgba(230, 31, 31, 0.42)',
  },
  wall: {
    position: 'absolute',
    zIndex: 17,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(165, 0, 0, 0.92)',
  },
});
