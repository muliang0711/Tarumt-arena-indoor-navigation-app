import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceMotion, Magnetometer, Pedometer } from 'expo-sensors';

import type {
  NavigationSensorStatus,
  NavigationTelemetry,
  ParsedMapFloor,
  Point,
  RouteModel,
} from '../../../shared/types';
import {
  getRouteDistance,
  getRouteHeadingAtDistance,
  getRoutePositionAtDistance,
} from './navigationScenario';

const METERS_PER_TILE = 1.4;
const PARTICLE_COUNT = 84;
const ARRIVAL_THRESHOLD_TILES = 0.35;

interface UseSensorRouteTrackingArgs {
  floor: ParsedMapFloor;
  route: RouteModel | null;
  enabled: boolean;
  initialPosition: Point;
}

interface UseSensorRouteTrackingModel {
  routeProgress: number;
  userPosition: Point;
  telemetry: NavigationTelemetry;
  hasArrived: boolean;
  start: () => Promise<boolean>;
  stop: () => void;
  reset: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

function smallestAngleDifference(a: number, b: number) {
  const delta = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(delta, 360 - delta);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createParticleCloud(distancePx: number, totalDistancePx: number) {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const noise = (Math.random() - 0.5) * 18;
    return clamp(distancePx + noise, 0, totalDistancePx);
  });
}

function resampleParticles(particles: number[], weights: number[]) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return [...particles];
  }

  const normalized = weights.map((weight) => weight / totalWeight);
  const cumulative: number[] = [];
  normalized.reduce((sum, value, index) => {
    const next = sum + value;
    cumulative[index] = next;
    return next;
  }, 0);

  return Array.from({ length: particles.length }, () => {
    const randomValue = Math.random();
    const index = cumulative.findIndex((threshold) => randomValue <= threshold);
    const selected = particles[index >= 0 ? index : particles.length - 1] ?? 0;
    return selected + (Math.random() - 0.5) * 8;
  });
}

export function useSensorRouteTracking({
  floor,
  route,
  enabled,
  initialPosition,
}: UseSensorRouteTrackingArgs): UseSensorRouteTrackingModel {
  const totalDistancePx = useMemo(() => getRouteDistance(route?.points ?? []), [route]);
  const arrivalThresholdPx = floor.tileSize * ARRIVAL_THRESHOLD_TILES;
  const subscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const particlesRef = useRef<number[]>([]);
  const lastPedometerCountRef = useRef(0);
  const lastDetectedStepAtRef = useRef(0);
  const headingRef = useRef<number | null>(null);
  const pedometerActiveRef = useRef(false);
  const motionBaselineRef = useRef(0.75);
  const lastMotionMagnitudeRef = useRef(0);
  const motionIntensityRef = useRef(0.75);

  const [routeDistancePx, setRouteDistancePx] = useState(0);
  const [status, setStatus] = useState<NavigationSensorStatus>('idle');
  const [modeLabel, setModeLabel] = useState('Sensor link idle');
  const [detailLabel, setDetailLabel] = useState('Start navigation to connect step and heading sensors.');
  const [headingDegrees, setHeadingDegrees] = useState<number | null>(null);
  const [stepCount, setStepCount] = useState(0);

  const cleanupSubscriptions = useCallback(() => {
    subscriptionsRef.current.forEach((subscription) => subscription.remove());
    subscriptionsRef.current = [];
    pedometerActiveRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cleanupSubscriptions();
    particlesRef.current = totalDistancePx > 0 ? createParticleCloud(0, totalDistancePx) : [];
    lastPedometerCountRef.current = 0;
    lastDetectedStepAtRef.current = 0;
    motionBaselineRef.current = 0.75;
    lastMotionMagnitudeRef.current = 0;
    motionIntensityRef.current = 0.75;
    headingRef.current = null;
    setRouteDistancePx(0);
    setStatus('idle');
    setModeLabel('Sensor link idle');
    setDetailLabel('Start navigation to connect step and heading sensors.');
    setHeadingDegrees(null);
    setStepCount(0);
  }, [cleanupSubscriptions, totalDistancePx]);

  useEffect(() => {
    if (!enabled) {
      cleanupSubscriptions();
    }
  }, [cleanupSubscriptions, enabled]);

  useEffect(() => cleanupSubscriptions, [cleanupSubscriptions]);

  useEffect(() => {
    reset();
  }, [reset, route?.id]);

  const advanceByStep = useCallback(
    (stepSource: 'pedometer' | 'motion') => {
      if (!route || totalDistancePx <= 0) {
        return;
      }

      const adaptiveStepMeters = clamp(0.72 + motionIntensityRef.current * 0.08, 0.55, 0.92);
      const predictedDistancePx = (adaptiveStepMeters / METERS_PER_TILE) * floor.tileSize;
      const nextParticles = (particlesRef.current.length > 0
        ? particlesRef.current
        : createParticleCloud(routeDistancePx, totalDistancePx)
      ).map((particleDistance) => {
        const processNoise = (Math.random() - 0.5) * floor.tileSize * 0.35;
        return clamp(particleDistance + predictedDistancePx + processNoise, 0, totalDistancePx);
      });

      const scoredParticles = nextParticles.map((particleDistance) => {
        const routeHeading = getRouteHeadingAtDistance(route.points, particleDistance);
        const headingPenalty =
          headingRef.current == null
            ? 1
            : Math.exp(-((smallestAngleDifference(headingRef.current, routeHeading) / 55) ** 2));
        const destinationBias = Math.exp(-(totalDistancePx - particleDistance) / (totalDistancePx || 1));

        return Math.max(0.001, headingPenalty * (0.55 + destinationBias));
      });

      const resampledParticles = resampleParticles(nextParticles, scoredParticles).map((particleDistance) =>
        clamp(particleDistance, 0, totalDistancePx),
      );
      const estimatedDistancePx = clamp(average(resampledParticles), 0, totalDistancePx);

      particlesRef.current = resampledParticles;
      setRouteDistancePx(estimatedDistancePx);
      setStepCount((current) => current + 1);
      setStatus(stepSource === 'pedometer' ? 'active' : 'fallback');
      setModeLabel(stepSource === 'pedometer' ? 'PDR + particle filter' : 'Motion fallback PDR');
      setDetailLabel(
        stepSource === 'pedometer'
          ? 'Live steps are projected onto valid route edges and resampled across particles.'
          : 'Using device motion peaks for steps, then constraining particles to the mapped path.',
      );
    },
    [floor.tileSize, route, routeDistancePx, totalDistancePx],
  );

  const start = useCallback(async () => {
    if (!route || totalDistancePx <= 0) {
      return false;
    }

    cleanupSubscriptions();
    particlesRef.current = createParticleCloud(0, totalDistancePx);
    lastPedometerCountRef.current = 0;
    lastDetectedStepAtRef.current = 0;
    motionBaselineRef.current = 0.75;
    lastMotionMagnitudeRef.current = 0;
    motionIntensityRef.current = 0.75;
    headingRef.current = null;
    setRouteDistancePx(0);
    setStepCount(0);
    setHeadingDegrees(null);
    setStatus('preparing');
    setModeLabel('Connecting sensors');
    setDetailLabel('Requesting motion, pedometer, and heading access from the device.');

    const pedometerPermissionPromise = Pedometer.requestPermissionsAsync().catch(() => null);
    const magnetometerPermissionPromise = Magnetometer.requestPermissionsAsync().catch(() => null);
    const motionPermissionPromise = DeviceMotion.requestPermissionsAsync().catch(() => null);

    const [
      pedometerAvailable,
      magnetometerAvailable,
      motionAvailable,
      pedometerPermission,
      magnetometerPermission,
      motionPermission,
    ] = await Promise.all([
      Pedometer.isAvailableAsync().catch(() => false),
      Magnetometer.isAvailableAsync().catch(() => false),
      DeviceMotion.isAvailableAsync().catch(() => false),
      pedometerPermissionPromise,
      magnetometerPermissionPromise,
      motionPermissionPromise,
    ]);

    const canUsePedometer = Boolean(pedometerAvailable && pedometerPermission?.granted);
    const canUseMagnetometer = Boolean(magnetometerAvailable && magnetometerPermission?.granted);
    const canUseMotion = Boolean(motionAvailable && motionPermission?.granted);

    if (!canUsePedometer && !canUseMotion) {
      const permissionRejected =
        pedometerPermission?.status === 'denied' ||
        magnetometerPermission?.status === 'denied' ||
        motionPermission?.status === 'denied';

      setStatus(permissionRejected ? 'permission-denied' : 'unavailable');
      setModeLabel(permissionRejected ? 'Sensor permission blocked' : 'Sensors unavailable');
      setDetailLabel(
        permissionRejected
          ? 'Allow motion access on a real phone to drive the blue user marker.'
          : 'This device cannot provide steps. Run the prototype on a phone with motion sensors.',
      );
      return false;
    }

    if (canUseMagnetometer) {
      Magnetometer.setUpdateInterval(240);
      subscriptionsRef.current.push(
        Magnetometer.addListener((measurement) => {
          const heading = normalizeDegrees((Math.atan2(measurement.y, measurement.x) * 180) / Math.PI);
          headingRef.current = heading;
          setHeadingDegrees(heading);
        }),
      );
    }

    if (canUseMotion) {
      DeviceMotion.setUpdateInterval(120);
      subscriptionsRef.current.push(
        DeviceMotion.addListener((measurement) => {
          const acceleration = measurement.acceleration;
          if (!acceleration) {
            return;
          }

          const magnitude = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
          motionIntensityRef.current = motionIntensityRef.current * 0.82 + magnitude * 0.18;
          motionBaselineRef.current = motionBaselineRef.current * 0.9 + magnitude * 0.1;

          if (pedometerActiveRef.current) {
            return;
          }

          const now = Date.now();
          const dynamicThreshold = Math.max(1.15, motionBaselineRef.current + 0.55);
          const crossedThreshold =
            magnitude >= dynamicThreshold && lastMotionMagnitudeRef.current < dynamicThreshold;
          if (crossedThreshold && now - lastDetectedStepAtRef.current > 460) {
            lastDetectedStepAtRef.current = now;
            advanceByStep('motion');
          }

          lastMotionMagnitudeRef.current = magnitude;
        }),
      );
    }

    if (canUsePedometer) {
      pedometerActiveRef.current = true;
      subscriptionsRef.current.push(
        Pedometer.watchStepCount((result) => {
          const delta = Math.max(0, result.steps - lastPedometerCountRef.current);
          lastPedometerCountRef.current = result.steps;

          for (let index = 0; index < delta; index += 1) {
            advanceByStep('pedometer');
          }
        }),
      );
    }

    setStatus(canUsePedometer ? 'active' : 'fallback');
    setModeLabel(canUsePedometer ? 'PDR + particle filter' : 'Motion fallback PDR');
    setDetailLabel(
      canUsePedometer
        ? canUseMagnetometer
          ? 'Step count and compass heading are now fused onto the constrained map route.'
          : 'Step count is live; route constraints keep particles on valid indoor paths.'
        : 'Step motion is inferred from acceleration peaks and then constrained to the route graph.',
    );

    return true;
  }, [advanceByStep, cleanupSubscriptions, route, totalDistancePx]);

  const userPosition = useMemo(() => {
    if (!route || totalDistancePx <= 0) {
      return initialPosition;
    }

    return getRoutePositionAtDistance(route.points, routeDistancePx);
  }, [initialPosition, route, routeDistancePx, totalDistancePx]);

  const routeProgress = totalDistancePx <= 0 ? 0 : clamp(routeDistancePx / totalDistancePx, 0, 1);
  const hasArrived = totalDistancePx > 0 && totalDistancePx - routeDistancePx <= arrivalThresholdPx;

  const telemetry = useMemo<NavigationTelemetry>(
    () => ({
      status,
      modeLabel,
      detailLabel,
      headingDegrees,
      stepCount,
    }),
    [detailLabel, headingDegrees, modeLabel, status, stepCount],
  );

  return {
    routeProgress,
    userPosition,
    telemetry,
    hasArrived,
    start,
    stop: cleanupSubscriptions,
    reset,
  };
}
