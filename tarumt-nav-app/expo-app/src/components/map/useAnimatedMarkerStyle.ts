import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

type AnimatedMarkerStyleInput = {
  anchorX?: number;
  anchorY?: number;
  height?: number;
  maxDurationMs?: number;
  minDurationMs?: number;
  pixelsPerSecond?: number;
  headingDegrees: number;
  rotateWithHeading?: boolean;
  screenX: number;
  screenY: number;
  size?: number;
  width?: number;
};

export function useAnimatedMarkerStyle(input: AnimatedMarkerStyleInput) {
  const {
    headingDegrees,
    maxDurationMs = 520,
    minDurationMs = 120,
    pixelsPerSecond = 260,
    rotateWithHeading = true,
    screenX,
    screenY,
  } = input;
  const width = input.width ?? input.size ?? 0;
  const height = input.height ?? input.size ?? 0;
  const anchorX = input.anchorX ?? width / 2;
  const anchorY = input.anchorY ?? height / 2;
  const animatedLeft = useRef(new Animated.Value(screenX - anchorX));
  const animatedTop = useRef(new Animated.Value(screenY - anchorY));
  const animatedHeading = useRef(new Animated.Value(headingDegrees));
  const headingTargetRef = useRef(headingDegrees);
  const currentLeftRef = useRef(screenX - anchorX);
  const currentTopRef = useRef(screenY - anchorY);

  useEffect(() => {
    const leftListenerId = animatedLeft.current.addListener(({ value }) => {
      currentLeftRef.current = value;
    });
    const topListenerId = animatedTop.current.addListener(({ value }) => {
      currentTopRef.current = value;
    });

    return () => {
      animatedLeft.current.removeListener(leftListenerId);
      animatedTop.current.removeListener(topListenerId);
    };
  }, []);

  useEffect(() => {
    const nextHeading = closestHeadingTarget(
      headingTargetRef.current,
      headingDegrees,
    );
    headingTargetRef.current = nextHeading;
    const nextLeft = screenX - anchorX;
    const nextTop = screenY - anchorY;
    const durationMs = calculateLinearCompensationDuration({
      currentLeft: currentLeftRef.current,
      currentTop: currentTopRef.current,
      maxDurationMs,
      minDurationMs,
      nextLeft,
      nextTop,
      pixelsPerSecond,
    });

    const animation = Animated.parallel([
      Animated.timing(animatedLeft.current, {
        duration: durationMs,
        easing: Easing.linear,
        toValue: nextLeft,
        useNativeDriver: false,
      }),
      Animated.timing(animatedTop.current, {
        duration: durationMs,
        easing: Easing.linear,
        toValue: nextTop,
        useNativeDriver: false,
      }),
      Animated.timing(animatedHeading.current, {
        duration: Math.min(durationMs, 240),
        easing: Easing.linear,
        toValue: nextHeading,
        useNativeDriver: false,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [
    anchorX,
    anchorY,
    headingDegrees,
    maxDurationMs,
    minDurationMs,
    pixelsPerSecond,
    screenX,
    screenY,
  ]);

  return {
    height,
    left: animatedLeft.current,
    top: animatedTop.current,
    ...(rotateWithHeading
      ? {
          transform: [
            {
              rotate: animatedHeading.current.interpolate({
                inputRange: [-3600, 3600],
                outputRange: ['-3600deg', '3600deg'],
              }),
            },
          ],
        }
      : {}),
    width,
  };
}

function closestHeadingTarget(currentHeading: number, nextHeading: number) {
  const delta = ((((nextHeading - currentHeading) % 360) + 540) % 360) - 180;
  return currentHeading + delta;
}

function calculateLinearCompensationDuration(input: {
  currentLeft: number;
  currentTop: number;
  maxDurationMs: number;
  minDurationMs: number;
  nextLeft: number;
  nextTop: number;
  pixelsPerSecond: number;
}) {
  const distancePixels = Math.hypot(
    input.nextLeft - input.currentLeft,
    input.nextTop - input.currentTop,
  );
  const rawDurationMs =
    (distancePixels / Math.max(1, input.pixelsPerSecond)) * 1000;

  return Math.min(
    input.maxDurationMs,
    Math.max(input.minDurationMs, Math.round(rawDurationMs)),
  );
}
