import type { DerivedNavigationEstimate } from '../../navigationInput/type';
import type { HeadingCandidateScore } from './HeadingCandidateScore';
import type { PdrPipelineDiagnostics } from './PdrPipelineDiagnostics';
import type { PdrPipelineState } from './PdrPipelineState';

export type PdrPipelineResult = {
  acceptedSampleCount: number;
  diagnostics: PdrPipelineDiagnostics;
  droppedSampleCount: number;
  estimate: DerivedNavigationEstimate;
  headingCandidates: HeadingCandidateScore[];
  latencyMs: number;
  nextState: PdrPipelineState;
};
