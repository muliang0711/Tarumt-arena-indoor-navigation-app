import type { PdrPipelineConfig } from './PdrPipelineConfig';
import type { PdrBatchDiagnostic } from './PdrBatchDiagnostic';
import type { PdrHeadingDiagnostic } from './PdrHeadingDiagnostic';
import type { PdrMovementDiagnostic } from './PdrMovementDiagnostic';
import type { StepDetectionDiagnostic } from './StepDetectionDiagnostic';

export type PdrPipelineDiagnostics = {
  batch: PdrBatchDiagnostic;
  configSnapshot: PdrPipelineConfig;
  heading: PdrHeadingDiagnostic;
  latencyMs: number;
  movement: PdrMovementDiagnostic;
  step: StepDetectionDiagnostic;
};
