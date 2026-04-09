import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  PanResponderInstance,
} from 'react-native';

import type { Bounds, Point, TransformState, ViewportSize } from '../types';

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

  const gestureRef = useRef({
    scale: DEFAULT_SCALE,
    translateX: 0,
    translateY: 0,
    distance: 0,
    focalWorldX: 0,
    focalWorldY: 0,
  });

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
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const scale = clamp(requestedScale ?? transform.scale, MIN_SCALE, MAX_SCALE);
    setTransform(
      clampTransform(
        {
          scale,
          translateX: viewport.width * 0.5 - point.x * scale,
          translateY: viewport.height * 0.5 - point.y * scale,
        },
        viewport,
        worldWidth,
        worldHeight,
      ),
    );
  }, [transform.scale, viewport, worldWidth, worldHeight]);

  const zoomBy = useCallback((delta: number) => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    setTransform((current) => {
      const nextScale = clamp(current.scale + delta, MIN_SCALE, MAX_SCALE);
      const centerX = viewport.width * 0.5;
      const centerY = viewport.height * 0.5;
      const worldX = (centerX - current.translateX) / current.scale;
      const worldY = (centerY - current.translateY) / current.scale;

      return clampTransform(
        {
          scale: nextScale,
          translateX: centerX - worldX * nextScale,
          translateY: centerY - worldY * nextScale,
        },
        viewport,
        worldWidth,
        worldHeight,
      );
    });
  }, [viewport, worldWidth, worldHeight]);

  const fitToBounds = useCallback(() => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    setTransform(computeFitTransform(viewport, focusBounds, worldWidth, worldHeight));
  }, [focusBounds, viewport, worldHeight, worldWidth]);

  const panResponder = useMemo<PanResponderInstance>(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        const midpoint = midpointBetweenTouches(touches);
        gestureRef.current = {
          scale: transform.scale,
          translateX: transform.translateX,
          translateY: transform.translateY,
          distance: distanceBetweenTouches(touches),
          focalWorldX: (midpoint.x - transform.translateX) / transform.scale,
          focalWorldY: (midpoint.y - transform.translateY) / transform.scale,
        };
      },
      onPanResponderMove: (event, gestureState: PanResponderGestureState) => {
        if (viewport.width <= 0 || viewport.height <= 0) {
          return;
        }

        const touches = event.nativeEvent.touches;
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
              viewport,
              worldWidth,
              worldHeight,
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
            viewport,
            worldWidth,
            worldHeight,
          ),
        );
      },
    });
  }, [transform.scale, transform.translateX, transform.translateY, viewport, worldHeight, worldWidth]);

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
