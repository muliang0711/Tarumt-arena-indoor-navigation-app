import type { HeadingCandidateScore } from './HeadingCandidateScore';

export type PdrHeadingDiagnostic = {
  desiredHeadingDegrees: number;
  observedHeadingDegrees: number;
  previousHeadingDegrees: number;
  topCandidate: HeadingCandidateScore | null;
};
