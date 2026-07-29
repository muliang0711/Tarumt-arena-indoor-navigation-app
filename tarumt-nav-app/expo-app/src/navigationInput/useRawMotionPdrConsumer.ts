import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceMotion, Magnetometer } from 'expo-sensors';

import { runPdrPipeline } from '../pdr';
import type {
  MotionInputSample,
  PdrPipelineResult,
  PdrPipelineState,
} from '../pdr';
import type { RedMarkerState, RoutePosition } from '../tiled/type';
import { deviceMotionToMotionInputSample } from './deviceMotionSampleModel';
import { magnetometerToHeadingDegrees } from './magnetometerHeadingModel';
import { applyLiveHeadingToMotionSample } from './motionSampleHeadingModel';
import { RAW_MOTION_CONSUMER_CONFIG } from './rawMotionConsumerConfig';
import {
  createRawMotionBatchStats,
  updateRawMotionStatsAfterFlush,
  updateRawMotionStatsAfterHeading,
  updateRawMotionStatsAfterSensorEvent,
} from './rawMotionStatsModel';
import { NAVIGATION_INPUT_POLICY } from './navigationInputPolicy';
import {
  createSensorDebugSessionId,
  sendSensorDebugBatchLog,
  sendSensorDebugSessionStart,
  sendSensorDebugSessionStop,
} from '../sensorDebug';
import { DEFAULT_PDR_PIPELINE_CONFIG } from '../pdr';
import type {
  DerivedNavigationEstimate,
  RawMotionBatchStats,
  RawMotionConsumerStatus,
} from './type';

type RawMotionPdrConsumerInput = {
  initialRedMarker: RedMarkerState;
  onEstimate: (estimate: DerivedNavigationEstimate) => void;
  onHeading?: (headingDegrees: number) => void;
  pixelsPerMeter?: number;
  routePosition: RoutePosition;
};

export function useRawMotionPdrConsumer({
  initialRedMarker,
  onEstimate,
  onHeading,
  pixelsPerMeter,
  routePosition,
}: RawMotionPdrConsumerInput) {
  const [status, setStatus] = useState<RawMotionConsumerStatus>('idle');
  const [stats, setStats] = useState<RawMotionBatchStats>(() =>
    createRawMotionBatchStats(),
  );
  const [lastPdrResult, setLastPdrResult] = useState<PdrPipelineResult | null>(
    null,
  );
  const rawBatchRef = useRef<MotionInputSample[]>([]);
  const deviceMotionSubscriptionRef =
    useRef<ReturnType<typeof DeviceMotion.addListener> | null>(null);
  const magnetometerSubscriptionRef =
    useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
  const usingMagnetometerHeadingRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pixelsPerMeterRef = useRef(pixelsPerMeter);
  const routePositionRef = useRef(routePosition);
  const pdrStateRef = useRef<PdrPipelineState>({
    headingDegrees: routePosition.headingDegrees,
    timestampMs: 0,
    x: initialRedMarker.screenX,
    y: initialRedMarker.screenY,
  });
  const onEstimateRef = useRef(onEstimate);
  const onHeadingRef = useRef(onHeading);
  const latestHeadingRef = useRef<number | null>(null);
  const hasNewRawSampleSinceFlushRef = useRef(false);
  const sensorDebugBatchIdRef = useRef(0);
  const sensorDebugSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    routePositionRef.current = routePosition;
  }, [routePosition]);

  useEffect(() => {
    pixelsPerMeterRef.current = pixelsPerMeter;
  }, [pixelsPerMeter]);

  useEffect(() => {
    onEstimateRef.current = onEstimate;
  }, [onEstimate]);

  useEffect(() => {
    onHeadingRef.current = onHeading;
  }, [onHeading]);

  const flushBatch = useCallback(() => {
    const samples = rawBatchRef.current;
    if (samples.length === 0 || !hasNewRawSampleSinceFlushRef.current) {
      return;
    }

    const nowMs = Date.now();
    rawBatchRef.current = pruneRollingRawBatch({
      nowMs,
      samples,
    });
    hasNewRawSampleSinceFlushRef.current = false;
    const result = runPdrPipeline({
      desiredHeadingDegrees: routePositionRef.current.headingDegrees,
      nowMs,
      pixelsPerMeter: pixelsPerMeterRef.current,
      previousState: pdrStateRef.current,
      samples,
    });

    pdrStateRef.current = result.nextState;
    setLastPdrResult(result);
    setStats((currentStats) =>
      updateRawMotionStatsAfterFlush({
        currentStats,
        pdrResult: result,
        rawSamplesInMemory: rawBatchRef.current.length,
      }),
    );
    const sessionId = sensorDebugSessionIdRef.current;
    if (sessionId) {
      sensorDebugBatchIdRef.current += 1;
      sendSensorDebugBatchLog({
        batchId: sensorDebugBatchIdRef.current,
        diagnostics: result.diagnostics,
        sessionId,
        timestampMs: nowMs,
      });
    }
    onEstimateRef.current(result.estimate);
  }, []);

  const updateHeading = useCallback((headingDegrees: number) => {
    latestHeadingRef.current = headingDegrees;
    onHeadingRef.current?.(headingDegrees);
    setStats((currentStats) =>
      updateRawMotionStatsAfterHeading({
        currentStats,
        headingDegrees,
      }),
    );
  }, []);

  const stop = useCallback(() => {
    const sessionId = sensorDebugSessionIdRef.current;
    if (sessionId) {
      sendSensorDebugSessionStop({
        endedAtMs: Date.now(),
        sessionId,
      });
      sensorDebugSessionIdRef.current = null;
    }
    flushTimerRef.current && clearInterval(flushTimerRef.current);
    flushTimerRef.current = null;
    deviceMotionSubscriptionRef.current?.remove();
    deviceMotionSubscriptionRef.current = null;
    magnetometerSubscriptionRef.current?.remove();
    magnetometerSubscriptionRef.current = null;
    usingMagnetometerHeadingRef.current = false;
    latestHeadingRef.current = null;
    hasNewRawSampleSinceFlushRef.current = false;
    rawBatchRef.current = [];
    setStats((currentStats) => ({
      ...currentStats,
      rawSamplesInMemory: 0,
    }));
    setStatus((currentStatus) =>
      currentStatus === 'running' || currentStatus === 'starting'
        ? 'stopped'
        : currentStatus,
    );
  }, []);

  const start = useCallback(async () => {
    stop();
    setStatus('starting');

    try {
      const available = await DeviceMotion.isAvailableAsync();
      if (!available) {
        setStatus('unavailable');
        return;
      }

      const permission = await DeviceMotion.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus('permission-denied');
        return;
      }

      DeviceMotion.setUpdateInterval(
        RAW_MOTION_CONSUMER_CONFIG.sensorUpdateIntervalMs,
      );

      const magnetometerAvailable = await Magnetometer.isAvailableAsync();
      usingMagnetometerHeadingRef.current = magnetometerAvailable;
      if (magnetometerAvailable) {
        Magnetometer.setUpdateInterval(
          RAW_MOTION_CONSUMER_CONFIG.headingUpdateIntervalMs,
        );
        magnetometerSubscriptionRef.current = Magnetometer.addListener(
          (measurement) => {
            updateHeading(magnetometerToHeadingDegrees(measurement));
          },
        );
      }

      deviceMotionSubscriptionRef.current = DeviceMotion.addListener((measurement) => {
        if (
          !usingMagnetometerHeadingRef.current &&
          Number.isFinite(measurement.rotation.alpha)
        ) {
          updateHeading(measurement.rotation.alpha);
        }

        const sample = deviceMotionToMotionInputSample({
          desiredHeadingDegrees: routePositionRef.current.headingDegrees,
          measurement,
          receivedAtMs: Date.now(),
        });

        if (!sample) {
          return;
        }

        rawBatchRef.current = [
          ...rawBatchRef.current,
          applyLiveHeadingToMotionSample({
            liveHeadingDegrees: latestHeadingRef.current,
            sample,
          }),
        ].slice(-NAVIGATION_INPUT_POLICY.maxRawSamplesInMemory);
        hasNewRawSampleSinceFlushRef.current = true;
        setStats((currentStats) =>
          updateRawMotionStatsAfterSensorEvent({
            currentStats,
            rawSamplesInMemory: rawBatchRef.current.length,
          }),
        );
      });
      flushTimerRef.current = setInterval(
        flushBatch,
        RAW_MOTION_CONSUMER_CONFIG.flushIntervalMs,
      );
      const startedAtMs = Date.now();
      pdrStateRef.current = {
        ...pdrStateRef.current,
        startedAtMs,
      };
      sensorDebugBatchIdRef.current = 0;
      sensorDebugSessionIdRef.current =
        createSensorDebugSessionId(startedAtMs);
      sendSensorDebugSessionStart({
        configSnapshot: {
          pdr: DEFAULT_PDR_PIPELINE_CONFIG,
          rawMotion: RAW_MOTION_CONSUMER_CONFIG,
        },
        sessionId: sensorDebugSessionIdRef.current,
        startedAtMs,
      });
      setStatus('running');
    } catch {
      stop();
      setStatus('error');
    }
  }, [flushBatch, stop, updateHeading]);

  const reset = useCallback(() => {
    rawBatchRef.current = [];
    latestHeadingRef.current = null;
    hasNewRawSampleSinceFlushRef.current = false;
    pdrStateRef.current = {
      headingDegrees: routePositionRef.current.headingDegrees,
      startedAtMs: undefined,
      timestampMs: 0,
      x: initialRedMarker.screenX,
      y: initialRedMarker.screenY,
    };
    setLastPdrResult(null);
    setStats(createRawMotionBatchStats());
  }, [initialRedMarker.screenX, initialRedMarker.screenY]);

  useEffect(() => stop, [stop]);

  return {
    lastPdrResult,
    reset,
    start,
    stats,
    status,
    stop,
  };
}

function pruneRollingRawBatch(input: {
  nowMs: number;
  samples: readonly MotionInputSample[];
}) {
  const retentionWindowMs = Math.max(
    DEFAULT_PDR_PIPELINE_CONFIG.batchWindowMs,
    DEFAULT_PDR_PIPELINE_CONFIG.maxBatchAgeMs,
  );

  return input.samples
    .filter((sample) => input.nowMs - sample.timestampMs <= retentionWindowMs)
    .slice(-NAVIGATION_INPUT_POLICY.maxRawSamplesInMemory);
}
