import { MotionEstimate } from '../estimate/motionEstimate';
import { Particle, ParticleScoringContext } from './particleTypes';

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

function angleDifference(leftRadians: number, rightRadians: number): number {
  const fullTurn = Math.PI * 2;
  const halfTurn = Math.PI;
  return Math.abs((normalizeAngle(leftRadians) - normalizeAngle(rightRadians) + halfTurn) % fullTurn - halfTurn);
}

function safeDistance(distanceMeters: number | undefined): number {
  return Math.max(0, normalizeFiniteNumber(distanceMeters ?? 0));
}

function scoreDistance(expectedMeters: number, actualMeters: number, toleranceMeters: number): number {
  const tolerance = Math.max(0.0001, toleranceMeters);
  const error = Math.abs(expectedMeters - actualMeters);
  return clamp01(1 - error / tolerance);
}

function scoreHeading(expectedRadians: number, actualRadians: number, toleranceRadians: number): number {
  const tolerance = Math.max(0.0001, toleranceRadians);
  const error = angleDifference(expectedRadians, actualRadians);
  return clamp01(1 - error / tolerance);
}

function scoreMotionConfidence(motion: MotionEstimate): number {
  return clamp01((motion.confidence + motion.heading.confidence + motion.displacement.confidence + motion.step.confidence) / 4);
}

export function scoreParticle(
  particle: Particle,
  context: ParticleScoringContext,
): Particle {
  const motion = context.motion;
  const weightFloor = clamp01(context.weightFloor ?? 0.0001);
  const actualDistanceMeters = safeDistance(particle.motion?.distanceMeters);
  const actualHeadingRadians = particle.motion?.headingRadians ?? particle.headingRadians;
  const motionDistanceMeters = safeDistance(motion.displacement.distanceMeters);
  const motionHeadingRadians = motion.heading.radians;
  const distanceToleranceMeters = Math.max(0.25, motionDistanceMeters || 1);
  const headingToleranceRadians = Math.max(Math.PI / 12, Math.PI * (1 - motion.heading.confidence));
  const distanceScore = scoreDistance(motionDistanceMeters, actualDistanceMeters, distanceToleranceMeters);
  const headingScore = scoreHeading(motionHeadingRadians, actualHeadingRadians, headingToleranceRadians);
  const motionConfidenceScore = scoreMotionConfidence(motion);
  const particleConfidenceScore = clamp01(particle.confidence);
  const customScore = context.customScore ? clamp01(context.customScore(particle, motion)) : 1;
  const rawScore = (distanceScore + headingScore + motionConfidenceScore + particleConfidenceScore) / 4;
  const weightedScore = clamp01(rawScore * customScore * particle.weight);

  return {
    ...particle,
    weight: Math.max(weightFloor, weightedScore),
    confidence: clamp01((particle.confidence + rawScore) / 2),
  };
}

export function scoreParticles(
  particles: readonly Particle[],
  context: ParticleScoringContext,
): Particle[] {
  return particles.map((particle) => scoreParticle(particle, context));
}
