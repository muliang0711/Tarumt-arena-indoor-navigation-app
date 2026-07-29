import { useEffect, useRef, useState } from 'react';

type ActorWalkAnimationInput = {
  frameCount: number;
  frameDurationMs: number;
  movementIdleDelayMs: number;
  screenX: number;
  screenY: number;
};

export function useActorWalkAnimation({
  frameCount,
  frameDurationMs,
  movementIdleDelayMs,
  screenX,
  screenY,
}: ActorWalkAnimationInput) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const previousPositionRef = useRef({ screenX, screenY });
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previousPosition = previousPositionRef.current;
    const moved =
      Math.hypot(
        screenX - previousPosition.screenX,
        screenY - previousPosition.screenY,
      ) > 0.25;
    previousPositionRef.current = { screenX, screenY };

    if (!moved) {
      return;
    }

    setIsWalking(true);
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }
    stopTimerRef.current = setTimeout(() => {
      setIsWalking(false);
      setFrameIndex(0);
      stopTimerRef.current = null;
    }, movementIdleDelayMs);
  }, [movementIdleDelayMs, screenX, screenY]);

  useEffect(
    () => () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isWalking) {
      return;
    }

    const safeFrameCount = Math.max(1, frameCount);
    const interval = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % safeFrameCount);
    }, frameDurationMs);

    return () => clearInterval(interval);
  }, [frameCount, frameDurationMs, isWalking]);

  return { frameIndex, isWalking };
}
