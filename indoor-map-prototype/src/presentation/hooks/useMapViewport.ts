import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  PanResponderInstance,
} from 'react-native';

import type { Bounds, Point, TransformState, ViewportSize } from '../../shared/types';

const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.55;
const MAX_SCALE = 3.2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampTransform(
  next: TransformState,
  viewport: ViewportSize,
  worldWidth: number,
  worldHeight: number,
) {
  const scaledWidth = worldWidth * next.scale;
  const scaledHeight = worldHeight * next.scale;

  let translateX = next.translateX;
  let translateY = next.translateY;

  if (scaledWidth <= viewport.width) {
    translateX = (viewport.width - scaledWidth) * 0.5;
  } else {
    translateX = clamp(translateX, viewport.width - scaledWidth, 0);
  }

  if (scaledHeight <= viewport.height) {
    translateY = (viewport.height - scaledHeight) * 0.5;
  } else {
    translateY = clamp(translateY, viewport.height - scaledHeight, 0);
  }

  return {
    scale: next.scale,
    translateX,
    translateY,
  };
}

function distanceBetweenTouches(touches: readonly any[]) {
  if (touches.length < 2) {
    return 0;
  }

  const [first, second] = touches;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function midpointBetweenTouches(touches: readonly any[]) {
  if (touches.length < 2) {
    return { x: 0, y: 0 };
  }

  const [first, second] = touches;
  return {
    x: (first.pageX + second.pageX) * 0.5,
    y: (first.pageY + second.pageY) * 0.5,
  };
}

function computeFitTransform(
  viewport: ViewportSize,
  focusBounds: Bounds,
  worldWidth: number,
  worldHeight: number,
) {
  const fitScale = Math.min(
    viewport.width / Math.max(focusBounds.width, 1),
    viewport.height / Math.max(focusBounds.height, 1),
  );
  const scale = clamp(fitScale * 0.92, MIN_SCALE, MAX_SCALE);
  const translateX = viewport.width * 0.5 - (focusBounds.x + focusBounds.width * 0.5) * scale;
  const translateY = viewport.height * 0.52 - (focusBounds.y + focusBounds.height * 0.5) * scale;

  return clampTransform(
    {
      scale,
      translateX,
      translateY,
    },
    viewport,
    worldWidth,
    worldHeight,
  );
}

interface UseMapViewportOptions {
  worldWidth: number;
  worldHeight: number;
  focusBounds: Bounds;
}

export function useMapViewport({ worldWidth, worldHeight, focusBounds }: UseMapViewportOptions) {
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [transform, setTransform] = useState<TransformState>({
    scale: DEFAULT_SCALE,
    translateX: 0,
    translateY: 0,
  });
  const viewportRef = useRef(viewport);
  const transformRef = useRef(transform);
  const boundsRef = useRef({ worldWidth, worldHeight, focusBounds });

  const gestureRef = useRef({
    scale: DEFAULT_SCALE,
    translateX: 0,
    translateY: 0,
    distance: 0,
    focalWorldX: 0,
    focalWorldY: 0,
    touchCount: 0,
  });

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    boundsRef.current = { worldWidth, worldHeight, focusBounds };
  }, [focusBounds, worldHeight, worldWidth]);

  useEffect(() => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    setTransform(computeFitTransform(viewport, focusBounds, worldWidth, worldHeight));
  }, [focusBounds, viewport.height, viewport.width, worldHeight, worldWidth]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => {
      if (Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5) {
        return current;
      }

      return { width, height };
    });
  };

  const centerOn = useCallback((point: Point, requestedScale?: number) => {
    const nextViewport = viewportRef.current;
    const nextBounds = boundsRef.current;
    const currentTransform = transformRef.current;
    if (nextViewport.width <= 0 || nextViewport.height <= 0) {
      return;
    }

    const scale = clamp(requestedScale ?? currentTransform.scale, MIN_SCALE, MAX_SCALE);
    setTransform(
      clampTransform(
        {
          scale,
          translateX: nextViewport.width * 0.5 - point.x * scale,
          translateY: nextViewport.height * 0.5 - point.y * scale,
        },
        nextViewport,
        nextBounds.worldWidth,
        nextBounds.worldHeight,
      ),
    );
  }, []);

  const zoomBy = useCallback((delta: number) => {
    const nextViewport = viewportRef.current;
    const nextBounds = boundsRef.current;
    if (nextViewport.width <= 0 || nextViewport.height <= 0) {
      return;
    }

    setTransform((current) => {
      const nextScale = clamp(current.scale + delta, MIN_SCALE, MAX_SCALE);
      const centerX = nextViewport.width * 0.5;
      const centerY = nextViewport.height * 0.5;
      const worldX = (centerX - current.translateX) / current.scale;
      const worldY = (centerY - current.translateY) / current.scale;

      return clampTransform(
        {
          scale: nextScale,
          translateX: centerX - worldX * nextScale,
          translateY: centerY - worldY * nextScale,
        },
        nextViewport,
        nextBounds.worldWidth,
        nextBounds.worldHeight,
      );
    });
  }, []);

  const fitToBounds = useCallback(() => {
    const nextViewport = viewportRef.current;
    const nextBounds = boundsRef.current;
    if (nextViewport.width <= 0 || nextViewport.height <= 0) {
      return;
    }

    setTransform(
      computeFitTransform(
        nextViewport,
        nextBounds.focusBounds,
        nextBounds.worldWidth,
        nextBounds.worldHeight,
      ),
    );
  }, []);

  const startGestureFromTouches = (touches: readonly any[]) => {
    const currentTransform = transformRef.current;
    const midpoint = midpointBetweenTouches(touches);
    gestureRef.current = {
      scale: currentTransform.scale,
      translateX: currentTransform.translateX,
      translateY: currentTransform.translateY,
      distance: distanceBetweenTouches(touches),
      focalWorldX: (midpoint.x - currentTransform.translateX) / currentTransform.scale,
      focalWorldY: (midpoint.y - currentTransform.translateY) / currentTransform.scale,
      touchCount: touches.length,
    };
  };

  const panResponder = useMemo<PanResponderInstance>(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
      onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (event, gestureState) =>
        event.nativeEvent.touches.length >= 2 ||
        Math.abs(gestureState.dx) > 1 ||
        Math.abs(gestureState.dy) > 1,
      onMoveShouldSetPanResponderCapture: (event, gestureState) =>
        event.nativeEvent.touches.length >= 2 ||
        Math.abs(gestureState.dx) > 1 ||
        Math.abs(gestureState.dy) > 1,
      onPanResponderGrant: (event) => {
        startGestureFromTouches(event.nativeEvent.touches);
      },
      onPanResponderMove: (event, gestureState: PanResponderGestureState) => {
        const nextViewport = viewportRef.current;
        const nextBounds = boundsRef.current;
        if (nextViewport.width <= 0 || nextViewport.height <= 0) {
          return;
        }

        const touches = event.nativeEvent.touches;
        if (gestureRef.current.touchCount !== touches.length) {
          startGestureFromTouches(touches);
        }

        if (touches.length >= 2) {
          const midpoint = midpointBetweenTouches(touches);
          const distance = distanceBetweenTouches(touches);
          const nextScale = clamp(
            gestureRef.current.scale * (distance / Math.max(gestureRef.current.distance, 1)),
            MIN_SCALE,
            MAX_SCALE,
          );

          setTransform(
            clampTransform(
              {
                scale: nextScale,
                translateX: midpoint.x - gestureRef.current.focalWorldX * nextScale,
                translateY: midpoint.y - gestureRef.current.focalWorldY * nextScale,
              },
              nextViewport,
              nextBounds.worldWidth,
              nextBounds.worldHeight,
            ),
          );
          return;
        }

        setTransform(
          clampTransform(
            {
              scale: gestureRef.current.scale,
              translateX: gestureRef.current.translateX + gestureState.dx,
              translateY: gestureRef.current.translateY + gestureState.dy,
            },
            nextViewport,
            nextBounds.worldWidth,
            nextBounds.worldHeight,
          ),
        );
      },
    });
  }, []);

  return {
    viewport,
    transform,
    onLayout,
    panHandlers: panResponder.panHandlers,
    zoomBy,
    centerOn,
    fitToBounds,
  };
}
