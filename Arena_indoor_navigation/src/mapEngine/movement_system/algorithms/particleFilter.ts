import { MotionEstimate } from '../estimate/motionEstimate';
import { createParticles } from './createParticles';
import { predictParticles } from './predictParticles';
import { resampleParticles } from './resampleParticles';
import { scoreParticles } from './scoreParticles';
import {
  CreateParticlesOptions,
  Particle,
  ParticleFilterSnapshot,
  ParticleFilterStepOptions,
  ParticleScoringContext,
  PredictParticlesOptions,
  ResampleParticlesOptions,
  WorldPosition,
} from './particleTypes';

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(value)));
}

function safeParticleCount(count: number): number {
  const normalizedCount = Math.floor(normalizeFiniteNumber(count, 100));
  return normalizedCount > 0 ? normalizedCount : 100;
}

function weightedAveragePosition(particles: readonly Particle[]): WorldPosition | null {
  const totalWeight = particles.reduce((sum, particle) => sum + Math.max(0, particle.weight), 0);

  if (totalWeight <= 0) {
    return null;
  }

  const position = particles.reduce(
    (accumulator, particle) => ({
      x: accumulator.x + particle.position.x * Math.max(0, particle.weight),
      y: accumulator.y + particle.position.y * Math.max(0, particle.weight),
    }),
    { x: 0, y: 0 },
  );

  return {
    x: position.x / totalWeight,
    y: position.y / totalWeight,
  };
}

function weightedAverageHeading(particles: readonly Particle[]): number | null {
  const totalWeight = particles.reduce((sum, particle) => sum + Math.max(0, particle.weight), 0);

  if (totalWeight <= 0) {
    return null;
  }

  const vector = particles.reduce(
    (accumulator, particle) => ({
      x: accumulator.x + Math.cos(particle.headingRadians) * Math.max(0, particle.weight),
      y: accumulator.y + Math.sin(particle.headingRadians) * Math.max(0, particle.weight),
    }),
    { x: 0, y: 0 },
  );

  if (vector.x === 0 && vector.y === 0) {
    return null;
  }

  return Math.atan2(vector.y, vector.x);
}

function selectBestParticle(particles: readonly Particle[]): Particle | null {
  if (particles.length === 0) {
    return null;
  }

  return particles.reduce((bestParticle, currentParticle) => {
    if (currentParticle.weight > bestParticle.weight) {
      return currentParticle;
    }

    if (currentParticle.weight === bestParticle.weight && currentParticle.confidence > bestParticle.confidence) {
      return currentParticle;
    }

    return bestParticle;
  }, particles[0]);
}

function normalizeParticleWeights(particles: readonly Particle[]): Particle[] {
  const totalWeight = particles.reduce((sum, particle) => sum + Math.max(0, particle.weight), 0);

  if (totalWeight <= 0) {
    const uniformWeight = 1 / Math.max(1, particles.length);
    return particles.map((particle) => ({
      ...particle,
      weight: uniformWeight,
    }));
  }

  return particles.map((particle) => ({
    ...particle,
    weight: Math.max(0, particle.weight) / totalWeight,
  }));
}

export function createParticleFilterState(
  initialPosition: WorldPosition,
  particleCount = 100,
  options: CreateParticlesOptions & { readonly initialHeadingRadians?: number } = {},
): ParticleFilterSnapshot {
  const particles = createParticles(initialPosition, safeParticleCount(particleCount), options);
  const normalizedParticles = normalizeParticleWeights(particles);
  const bestParticle = selectBestParticle(normalizedParticles);

  return {
    particles: normalizedParticles,
    generation: 0,
    position: weightedAveragePosition(normalizedParticles),
    headingRadians: weightedAverageHeading(normalizedParticles),
    confidence: bestParticle ? clamp01(bestParticle.confidence) : 0,
    bestParticle,
    totalWeight: normalizedParticles.reduce((sum, particle) => sum + particle.weight, 0),
  };
}

export function updateParticleFilterState(
  state: ParticleFilterSnapshot,
  motion: MotionEstimate,
  options: ParticleFilterStepOptions = {},
): ParticleFilterSnapshot {
  const predictionOptions: PredictParticlesOptions = {
    headingBlend: options.headingBlend,
    distanceNoiseRatio: options.distanceNoiseRatio,
    headingNoiseRadians: options.headingNoiseRadians,
    positionNoiseMeters: options.positionNoiseMeters,
    randomSource: options.randomSource,
  };

  const scoringContext: ParticleScoringContext = {
    motion,
    weightFloor: options.weightFloor,
    customScore: options.customScore,
  };

  const resampleOptions: ResampleParticlesOptions = {
    randomSource: options.randomSource,
    idPrefix: options.idPrefix,
    generation: state.generation + 1,
  };

  const predictedParticles = predictParticles(state.particles, motion, predictionOptions);
  const scoredParticles = scoreParticles(predictedParticles, scoringContext);
  const resampledParticles = resampleParticles(
    scoredParticles,
    options.particleCount ?? scoredParticles.length,
    resampleOptions,
  );
  const normalizedParticles = normalizeParticleWeights(resampledParticles);
  const bestParticle = selectBestParticle(normalizedParticles);

  return {
    particles: normalizedParticles,
    generation: state.generation + 1,
    lastMotion: motion,
    position: weightedAveragePosition(normalizedParticles),
    headingRadians: weightedAverageHeading(normalizedParticles),
    confidence: bestParticle ? clamp01(bestParticle.confidence) : 0,
    bestParticle,
    totalWeight: normalizedParticles.reduce((sum, particle) => sum + particle.weight, 0),
  };
}

export function runParticleFilter(
  initialPosition: WorldPosition,
  motions: readonly MotionEstimate[],
  particleCount = 100,
  options: ParticleFilterStepOptions = {},
): ParticleFilterSnapshot {
  let snapshot = createParticleFilterState(initialPosition, particleCount, options);

  for (const motion of motions) {
    snapshot = updateParticleFilterState(snapshot, motion, options);
  }

  return snapshot;
}
