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
  children: ReactNode;
};

export function CameraViewport({
  camera,
  contentWidth,
  contentHeight,
  height,
  onLayout,
  onPanBy,
  children,
}: CameraViewportProps) {
  const lastPan = useRef({ x: 0, y: 0 });
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(onPanBy),
        onMoveShouldSetPanResponder: () => Boolean(onPanBy),
        onPanResponderGrant: () => {
          lastPan.current = { x: 0, y: 0 };
        },
        onPanResponderMove: (_event, gestureState) => {
          if (!onPanBy || gestureState.numberActiveTouches > 1) {
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
        },
        onPanResponderTerminate: () => {
          lastPan.current = { x: 0, y: 0 };
        },
      }),
    [onPanBy],
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
