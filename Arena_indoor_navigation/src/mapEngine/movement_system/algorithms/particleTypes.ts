import type { MotionEstimate } from '../estimate/motionEstimate';
import type { WorldPosition } from '../../shared';

export type { WorldPosition } from '../../shared';

export interface ParticleMotionSnapshot {
  readonly previousPosition: WorldPosition;
  readonly predictedPosition: WorldPosition;
  readonly distanceMeters: number;
  readonly headingRadians: number;
}

export interface Particle {
  readonly id: string;
  readonly position: WorldPosition;
  readonly previousPosition?: WorldPosition;
  readonly headingRadians: number;
  readonly weight: number;
  readonly confidence: number;
  readonly age: number;
  readonly motion?: ParticleMotionSnapshot;
}

export interface ParticleFilterState {
  readonly particles: readonly Particle[];
  readonly generation: number;
}

export interface ParticleFilterEstimate {
  readonly position: WorldPosition | null;
  readonly headingRadians: number | null;
  readonly confidence: number;
  readonly bestParticle: Particle | null;
  readonly totalWeight: number;
}

export interface ParticleFilterSnapshot extends ParticleFilterState, ParticleFilterEstimate {
  readonly lastMotion?: MotionEstimate;
}

export interface CreateParticlesOptions {
  readonly initialHeadingRadians?: number;
  readonly positionSpreadMeters?: number;
  readonly headingSpreadRadians?: number;
  readonly initialWeight?: number;
  readonly initialConfidence?: number;
}

export interface PredictParticlesOptions {
  readonly headingBlend?: number;
  readonly distanceNoiseRatio?: number;
  readonly headingNoiseRadians?: number;
  readonly positionNoiseMeters?: number;
  readonly randomSource?: () => number;
}

export interface ParticleScoringContext {
  readonly motion: MotionEstimate;
  readonly weightFloor?: number;
  readonly customScore?: (particle: Particle, motion: MotionEstimate) => number;
}

export interface ResampleParticlesOptions {
  readonly randomSource?: () => number;
  readonly idPrefix?: string;
  readonly generation?: number;
}

export interface ParticleFilterStepOptions extends CreateParticlesOptions, PredictParticlesOptions, ResampleParticlesOptions {
  readonly particleCount?: number;
  readonly weightFloor?: number;
  readonly customScore?: (particle: Particle, motion: MotionEstimate) => number;
}
