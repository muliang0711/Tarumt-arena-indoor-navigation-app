import { CreateParticlesOptions, Particle, WorldPosition } from './particleTypes';

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(value)));
}

function normalizePositiveCount(count: number): number {
  const normalizedCount = Math.floor(normalizeFiniteNumber(count, 1));
  return normalizedCount > 0 ? normalizedCount : 1;
}

function normalizeAngle(radians: number): number {
  const fullTurn = Math.PI * 2;
  const wrappedRadians = normalizeFiniteNumber(radians) % fullTurn;
  return wrappedRadians >= 0 ? wrappedRadians : wrappedRadians + fullTurn;
}

function rotateVector(angleRadians: number, radius: number): WorldPosition {
  return {
    x: Math.cos(angleRadians) * radius,
    y: Math.sin(angleRadians) * radius,
  };
}

function createParticleId(index: number): string {
  return `particle-${index}`;
}

export function createParticles(
  initialPosition: WorldPosition,
  particleCount = 100,
  options: CreateParticlesOptions = {},
): Particle[] {
  const count = normalizePositiveCount(particleCount);
  const initialHeadingRadians = normalizeAngle(options.initialHeadingRadians ?? 0);
  const positionSpreadMeters = Math.max(0, normalizeFiniteNumber(options.positionSpreadMeters ?? 0.5));
  const headingSpreadRadians = Math.max(0, normalizeFiniteNumber(options.headingSpreadRadians ?? Math.PI / 6));
  const initialWeight = clamp01(options.initialWeight ?? 1 / count);
  const initialConfidence = clamp01(options.initialConfidence ?? 1);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const particles: Particle[] = [];

  for (let index = 0; index < count; index += 1) {
    const radialProgress = Math.sqrt((index + 1) / (count + 1));
    const radius = positionSpreadMeters * radialProgress;
    const angle = goldenAngle * index;
    const offset = rotateVector(angle, radius);
    const headingOffset = Math.sin(angle) * headingSpreadRadians;

    particles.push({
      id: createParticleId(index),
      position: {
        x: initialPosition.x + offset.x,
        y: initialPosition.y + offset.y,
      },
      headingRadians: normalizeAngle(initialHeadingRadians + headingOffset),
      weight: initialWeight,
      confidence: initialConfidence,
      age: 0,
    });
  }

  return particles;
}
