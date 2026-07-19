import type { HeadingCandidateScore } from '../type';
import { normalizeDegrees, shortestAngleDistanceDegrees } from './angleModel';

export function rankHeadingCandidates(input: {
  desiredHeadingDegrees: number;
  observedHeadingDegrees: number;
  previousHeadingDegrees: number;
}) {
  const candidates: HeadingCandidateScore[] = [
    scoreCandidate('desired', input.desiredHeadingDegrees, input),
    scoreCandidate('observed', input.observedHeadingDegrees, input),
    scoreCandidate('previous', input.previousHeadingDegrees, input),
  ];

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreCandidate(
  label: HeadingCandidateScore['label'],
  headingDegrees: number,
  input: {
    desiredHeadingDegrees: number;
    observedHeadingDegrees: number;
    previousHeadingDegrees: number;
  },
): HeadingCandidateScore {
  const desiredScore =
    1 -
    shortestAngleDistanceDegrees(headingDegrees, input.desiredHeadingDegrees) /
      180;
  const observedScore =
    1 -
    shortestAngleDistanceDegrees(headingDegrees, input.observedHeadingDegrees) /
      180;
  const previousScore =
    1 -
    shortestAngleDistanceDegrees(headingDegrees, input.previousHeadingDegrees) /
      180;

  return {
    headingDegrees: normalizeDegrees(headingDegrees),
    label,
    score: desiredScore * 0.55 + observedScore * 0.35 + previousScore * 0.1,
  };
}
