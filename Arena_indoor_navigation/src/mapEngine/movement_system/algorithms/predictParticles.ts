import { MotionEstimate } from '../estimate/motionEstimate';
import { Particle, PredictParticlesOptions, WorldPosition } from './particleTypes';

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(value)));
}

function normalizeAngle(radians: number): number {
  const fullTurn = Math.PI * 2;
  const wrappedRadians = normalizeFiniteNumber(radians) % fullTurn;
  return wrappedRadians >= 0 ? wrappedRadians : wrappedRadians + fullTurn;
}

function angleDelta(leftRadians: number, rightRadians: number): number {
  const fullTurn = Math.PI * 2;
  const halfTurn = Math.PI;
  const delta = (normalizeAngle(leftRadians) - normalizeAngle(rightRadians) + halfTurn) % fullTurn - halfTurn;
  return delta;
}

function blendAngle(leftRadians: number, rightRadians: number, blend: number): number {
  const normalizedBlend = clamp01(blend);
  const delta = angleDelta(rightRadians, leftRadians);
  return normalizeAngle(leftRadians + delta * normalizedBlend);
}

function nextRandom(randomSource?: () => number): number {
  const rawValue = randomSource ? randomSource() : Math.random();
  return clamp01(rawValue);
}

function centeredNoise(randomSource?: () => number): number {
  return nextRandom(randomSource) * 2 - 1;
}

function translate(position: WorldPosition, headingRadians: number, distanceMeters: number): WorldPosition {
  return {
    x: position.x + Math.cos(headingRadians) * distanceMeters,
    y: position.y + Math.sin(headingRadians) * distanceMeters,
  };
}

export function predictParticles(
  particles: readonly Particle[],
  motion: MotionEstimate,
  options: PredictParticlesOptions = {},
): Particle[] {
  const headingBlend = clamp01(options.headingBlend ?? 0.7);
  const distanceNoiseRatio = Math.max(0, normalizeFiniteNumber(options.distanceNoiseRatio ?? 0.08));
  const headingNoiseRadians = Math.max(0, normalizeFiniteNumber(options.headingNoiseRadians ?? Math.PI / 64));
  const positionNoiseMeters = Math.max(0, normalizeFiniteNumber(options.positionNoiseMeters ?? 0.03));
  const randomSource = options.randomSource;
  const motionHeadingRadians = motion.heading.radians;
  const motionDistanceMeters = Math.max(0, motion.displacement.distanceMeters);
  const motionConfidence = clamp01(motion.confidence);

  return particles.map((particle, index) => {
    const headingJitter = centeredNoise(randomSource) * headingNoiseRadians;
    const distanceJitter = centeredNoise(randomSource) * distanceNoiseRatio * motionDistanceMeters;
    const blendedHeading = blendAngle(
      particle.headingRadians,
      motionHeadingRadians,
      Math.min(1, headingBlend * motion.heading.confidence * motionConfidence),
    );
    const predictedHeadingRadians = normalizeAngle(blendedHeading + headingJitter);
    const predictedDistanceMeters = Math.max(0, motionDistanceMeters + distanceJitter);
    const predictedPosition = translate(particle.position, predictedHeadingRadians, predictedDistanceMeters);
    const positionOffsetX = centeredNoise(randomSource) * positionNoiseMeters;
    const positionOffsetY = centeredNoise(randomSource) * positionNoiseMeters;

    return {
      ...particle,
      position: {
        x: predictedPosition.x + positionOffsetX,
        y: predictedPosition.y + positionOffsetY,
      },
      previousPosition: particle.position,
      headingRadians: predictedHeadingRadians,
      confidence: clamp01((particle.confidence + motionConfidence) / 2),
      age: particle.age + 1,
      motion: {
        previousPosition: particle.position,
        predictedPosition,
        distanceMeters: predictedDistanceMeters,
        headingRadians: predictedHeadingRadians,
      },
    };
  });
}
