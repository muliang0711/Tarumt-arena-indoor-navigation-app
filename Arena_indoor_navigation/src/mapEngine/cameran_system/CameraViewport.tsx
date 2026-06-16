import { ReactNode, useMemo, useRef } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { radius } from '../../components/theme';
import { CameraState, Point } from './cameraModel';

type CameraViewportProps = {
  camera: CameraState;
  contentWidth: number;
  contentHeight: number;
  height: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPanBy?: (delta: Point) => void;
  onZoomBy?: (factor: number, focalPoint: Point) => void;
  children: ReactNode;
};

export function CameraViewport({
  camera,
  contentWidth,
  contentHeight,
  height,
  onLayout,
  onPanBy,
  onZoomBy,
  children,
}: CameraViewportProps) {
  const lastPan = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(onPanBy || onZoomBy),
        onMoveShouldSetPanResponder: () => Boolean(onPanBy || onZoomBy),
        onPanResponderGrant: (event) => {
          lastPan.current = { x: 0, y: 0 };
          lastPinchDistance.current = getTouchDistance(event.nativeEvent.touches);
        },
        onPanResponderMove: (event, gestureState) => {
          if (gestureState.numberActiveTouches > 1) {
            const touches = event.nativeEvent.touches;
            const nextDistance = getTouchDistance(touches);
            const focalPoint = getTouchCenter(touches);
            if (onZoomBy && lastPinchDistance.current && nextDistance && focalPoint) {
              onZoomBy(nextDistance / lastPinchDistance.current, focalPoint);
            }
            lastPinchDistance.current = nextDistance;
            return;
          }

          lastPinchDistance.current = null;
          if (!onPanBy) {
            return;
          }
          const nextPan = { x: gestureState.dx, y: gestureState.dy };
          onPanBy({
            x: nextPan.x - lastPan.current.x,
            y: nextPan.y - lastPan.current.y,
          });
          lastPan.current = nextPan;
        },
        onPanResponderRelease: () => {
          lastPan.current = { x: 0, y: 0 };
          lastPinchDistance.current = null;
        },
        onPanResponderTerminate: () => {
          lastPan.current = { x: 0, y: 0 };
          lastPinchDistance.current = null;
        },
      }),
    [onPanBy, onZoomBy],
  );

  return (
    <View style={[styles.viewport, { height }]} onLayout={onLayout} {...panResponder.panHandlers}>
      <View
        style={[
          styles.stage,
          {
            width: contentWidth,
            height: contentHeight,
            transform: [
              { translateX: camera.offsetX },
              { translateY: camera.offsetY },
              { scale: camera.scale },
            ],
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function getTouchDistance(touches: Array<{ locationX: number; locationY: number }>) {
  if (touches.length < 2) {
    return null;
  }
  const [first, second] = touches;
  return Math.hypot(second.locationX - first.locationX, second.locationY - first.locationY);
}

function getTouchCenter(touches: Array<{ locationX: number; locationY: number }>): Point | null {
  if (touches.length < 2) {
    return null;
  }
  const [first, second] = touches;
  return {
    x: (first.locationX + second.locationX) / 2,
    y: (first.locationY + second.locationY) / 2,
  };
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: '#1f2933',
  },
  stage: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#f5f4ef',
  },
});
