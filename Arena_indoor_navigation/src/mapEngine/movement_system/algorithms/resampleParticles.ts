import { Particle, ResampleParticlesOptions } from './particleTypes';

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(value)));
}

function nextRandom(randomSource?: () => number): number {
  const rawValue = randomSource ? randomSource() : Math.random();
  return clamp01(rawValue);
}

function normalizeWeights(particles: readonly Particle[]): number[] {
  const totalWeight = particles.reduce((sum, particle) => sum + Math.max(0, particle.weight), 0);

  if (totalWeight <= 0) {
    const uniformWeight = 1 / Math.max(1, particles.length);
    return particles.map(() => uniformWeight);
  }

  return particles.map((particle) => Math.max(0, particle.weight) / totalWeight);
}

function cloneParticle(particle: Particle, id: string): Particle {
  return {
    ...particle,
    id,
    weight: 1,
  };
}

export function resampleParticles(
  particles: readonly Particle[],
  targetCount = particles.length,
  options: ResampleParticlesOptions = {},
): Particle[] {
  if (particles.length === 0 || targetCount <= 0) {
    return [];
  }

  const normalizedTargetCount = Math.max(1, Math.floor(targetCount));
  const weights = normalizeWeights(particles);
  const cumulativeWeights: number[] = [];
  let cumulativeWeight = 0;

  for (const weight of weights) {
    cumulativeWeight += weight;
    cumulativeWeights.push(cumulativeWeight);
  }

  const step = 1 / normalizedTargetCount;
  const start = nextRandom(options.randomSource) * step;
  const generation = Math.floor(normalizeFiniteNumber(options.generation ?? 0));
  const idPrefix = options.idPrefix ?? 'particle';
  const resampledParticles: Particle[] = [];

  for (let index = 0; index < normalizedTargetCount; index += 1) {
    const threshold = start + step * index;
    let selectedIndex = cumulativeWeights.findIndex((weight) => weight >= threshold);

    if (selectedIndex < 0) {
      selectedIndex = particles.length - 1;
    }

    const sourceParticle = particles[selectedIndex];
    resampledParticles.push(cloneParticle(sourceParticle, `${idPrefix}-${generation}-${index}`));
  }

  return resampledParticles;
}
