import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { radius } from '../../components/theme';
import { CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM, CameraState } from './cameraModel';

type CameraViewportProps = {
  camera: CameraState;
  contentWidth: number;
  contentHeight: number;
  height: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onCameraChange?: (camera: CameraState) => void;
  onGestureStart?: () => void;
  children: ReactNode;
};

export function CameraViewport({
  camera,
  contentWidth,
  contentHeight,
  height,
  onLayout,
  onCameraChange,
  onGestureStart,
  children,
}: CameraViewportProps) {
  const translateX = useRef(new Animated.Value(camera.offsetX)).current;
  const translateY = useRef(new Animated.Value(camera.offsetY)).current;
  const scale = useRef(new Animated.Value(clampZoom(camera.scale))).current;
  const cameraRef = useRef(camera);
  const panStart = useRef({ x: camera.offsetX, y: camera.offsetY });
  const pinchStart = useRef({
    x: camera.offsetX,
    y: camera.offsetY,
    scale: clampZoom(camera.scale),
  });

  useEffect(() => {
    const nextCamera = {
      ...camera,
      scale: clampZoom(camera.scale),
    };
    cameraRef.current = nextCamera;
    translateX.setValue(nextCamera.offsetX);
    translateY.setValue(nextCamera.offsetY);
    scale.setValue(nextCamera.scale);
  }, [camera, scale, translateX, translateY]);

  const gestures = useMemo(() => {
    function updateCamera(nextCamera: CameraState) {
      cameraRef.current = nextCamera;
      translateX.setValue(nextCamera.offsetX);
      translateY.setValue(nextCamera.offsetY);
      scale.setValue(nextCamera.scale);
    }

    function commitCamera() {
      onCameraChange?.(cameraRef.current);
    }

    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        onGestureStart?.();
        panStart.current = {
          x: cameraRef.current.offsetX,
          y: cameraRef.current.offsetY,
        };
      })
      .onUpdate((event) => {
        updateCamera({
          ...cameraRef.current,
          offsetX: panStart.current.x + event.translationX,
          offsetY: panStart.current.y + event.translationY,
        });
      })
      .onFinalize(commitCamera);

    const pinchGesture = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        onGestureStart?.();
        pinchStart.current = {
          x: cameraRef.current.offsetX,
          y: cameraRef.current.offsetY,
          scale: clampZoom(cameraRef.current.scale),
        };
      })
      .onUpdate((event) => {
        const nextScale = clampZoom(pinchStart.current.scale * event.scale);
        const focalX = Number.isFinite(event.focalX) ? event.focalX : 0;
        const focalY = Number.isFinite(event.focalY) ? event.focalY : 0;
        const worldX = (focalX - pinchStart.current.x) / Math.max(CAMERA_MIN_ZOOM, pinchStart.current.scale);
        const worldY = (focalY - pinchStart.current.y) / Math.max(CAMERA_MIN_ZOOM, pinchStart.current.scale);

        updateCamera({
          scale: nextScale,
          offsetX: focalX - worldX * nextScale,
          offsetY: focalY - worldY * nextScale,
        });
      })
      .onFinalize(commitCamera);

    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [onCameraChange, onGestureStart, scale, translateX, translateY]);

  return (
    <GestureDetector gesture={gestures}>
      <View style={[styles.viewport, { height }]} onLayout={onLayout}>
        <Animated.View
          style={[
            styles.stage,
            {
              width: contentWidth,
              height: contentHeight,
              transform: [
                { translateX },
                { translateY },
                { scale },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function clampZoom(value: number) {
  if (!Number.isFinite(value)) {
    return CAMERA_MIN_ZOOM;
  }
  return Math.min(CAMERA_MAX_ZOOM, Math.max(CAMERA_MIN_ZOOM, value));
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
