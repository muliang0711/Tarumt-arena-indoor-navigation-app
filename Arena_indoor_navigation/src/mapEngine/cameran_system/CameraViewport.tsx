import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CameraState,
  constrainCameraToBounds,
  minimumCoverScale,
} from './cameraModel';
import {
  shouldSyncCameraFromProps,
  type CameraInteractionState,
} from './cameraViewportInteraction';

type CameraViewportProps = {
  camera: CameraState;
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  height: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onCameraChange?: (camera: CameraState) => void;
  onInteractionStart?: () => void;
  children: ReactNode;
};

export function CameraViewport({
  camera,
  contentWidth,
  contentHeight,
  viewportWidth,
  height,
  onLayout,
  onCameraChange,
  onInteractionStart,
  children,
}: CameraViewportProps) {
  const translateX = useRef(new Animated.Value(camera.offsetX)).current;
  const translateY = useRef(new Animated.Value(camera.offsetY)).current;
  const sceneBounds = useMemo(
    () => ({ x: 0, y: 0, width: contentWidth, height: contentHeight }),
    [contentHeight, contentWidth],
  );
  const viewportSize = useMemo(
    () => ({ width: Math.max(1, viewportWidth), height }),
    [height, viewportWidth],
  );
  const minimumScale = minimumCoverScale(sceneBounds, viewportSize);
  const scale = useRef(new Animated.Value(clampZoom(camera.scale, minimumScale))).current;
  const cameraRef = useRef(camera);
  const interactionState = useRef<CameraInteractionState>({
    isGestureActive: false,
  });
  const panStart = useRef({ x: camera.offsetX, y: camera.offsetY });
  const pinchStart = useRef({
    x: camera.offsetX,
    y: camera.offsetY,
    scale: clampZoom(camera.scale, minimumScale),
  });

  useEffect(() => {
    if (!shouldSyncCameraFromProps(interactionState.current)) {
      return;
    }
    const nextCamera = {
      ...camera,
      scale: clampZoom(camera.scale, minimumScale),
    };
    cameraRef.current = nextCamera;
    translateX.setValue(nextCamera.offsetX);
    translateY.setValue(nextCamera.offsetY);
    scale.setValue(nextCamera.scale);
  }, [camera, minimumScale, scale, translateX, translateY]);

  const gestures = useMemo(() => {
    function updateCamera(nextCamera: CameraState) {
      const constrainedCamera = constrainCameraToBounds(
        nextCamera,
        sceneBounds,
        viewportSize,
      );
      cameraRef.current = constrainedCamera;
      translateX.setValue(constrainedCamera.offsetX);
      translateY.setValue(constrainedCamera.offsetY);
      scale.setValue(constrainedCamera.scale);
    }

    function commitCamera() {
      interactionState.current.isGestureActive = false;
      onCameraChange?.(cameraRef.current);
    }

    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        interactionState.current.isGestureActive = true;
        onInteractionStart?.();
        panStart.current = {
          x: cameraRef.current.offsetX,
          y: cameraRef.current.offsetY,
        };
      })
      .onUpdate((event) => {
        updateCamera({
          scale: cameraRef.current.scale,
          offsetX: panStart.current.x + event.translationX,
          offsetY: panStart.current.y + event.translationY,
        });
      })
      .onFinalize(commitCamera);

    const pinchGesture = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        interactionState.current.isGestureActive = true;
        onInteractionStart?.();
        pinchStart.current = {
          x: cameraRef.current.offsetX,
          y: cameraRef.current.offsetY,
          scale: clampZoom(cameraRef.current.scale, minimumScale),
        };
      })
      .onUpdate((event) => {
        const nextScale = clampZoom(pinchStart.current.scale * event.scale, minimumScale);
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
  }, [
    minimumScale,
    onCameraChange,
    onInteractionStart,
    scale,
    sceneBounds,
    translateX,
    translateY,
    viewportSize,
  ]);

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

function clampZoom(value: number, minimumScale = CAMERA_MIN_ZOOM) {
  if (!Number.isFinite(value)) {
    return minimumScale;
  }
  return Math.min(CAMERA_MAX_ZOOM, Math.max(minimumScale, value));
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    backgroundColor: '#1f2933',
  },
  stage: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#f5f4ef',
  },
});
