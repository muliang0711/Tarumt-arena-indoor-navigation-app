import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

List<HeadingCandidateScore> rankHeadingCandidates({
  required double desiredHeadingDegrees,
  required double observedHeadingDegrees,
  required double previousHeadingDegrees,
}) {
  final candidates = <({int index, HeadingCandidateScore score})>[
    (
      index: 0,
      score: _scoreCandidate(
        HeadingCandidateLabel.desired,
        desiredHeadingDegrees,
        desiredHeadingDegrees: desiredHeadingDegrees,
        observedHeadingDegrees: observedHeadingDegrees,
        previousHeadingDegrees: previousHeadingDegrees,
      ),
    ),
    (
      index: 1,
      score: _scoreCandidate(
        HeadingCandidateLabel.observed,
        observedHeadingDegrees,
        desiredHeadingDegrees: desiredHeadingDegrees,
        observedHeadingDegrees: observedHeadingDegrees,
        previousHeadingDegrees: previousHeadingDegrees,
      ),
    ),
    (
      index: 2,
      score: _scoreCandidate(
        HeadingCandidateLabel.previous,
        previousHeadingDegrees,
        desiredHeadingDegrees: desiredHeadingDegrees,
        observedHeadingDegrees: observedHeadingDegrees,
        previousHeadingDegrees: previousHeadingDegrees,
      ),
    ),
  ];

  candidates.sort((left, right) {
    final difference = right.score.score - left.score.score;
    // A JavaScript sort comparator returning NaN is treated as zero. Preserve
    // the original insertion order for NaN and exact score ties.
    if (difference.isNaN || difference == 0) {
      return left.index - right.index;
    }
    return difference < 0 ? -1 : 1;
  });
  return List.unmodifiable(candidates.map((entry) => entry.score));
}

HeadingCandidateScore _scoreCandidate(
  HeadingCandidateLabel label,
  double headingDegrees, {
  required double desiredHeadingDegrees,
  required double observedHeadingDegrees,
  required double previousHeadingDegrees,
}) {
  final desiredScore =
      1 -
      shortestAngleDistanceDegrees(headingDegrees, desiredHeadingDegrees) / 180;
  final observedScore =
      1 -
      shortestAngleDistanceDegrees(headingDegrees, observedHeadingDegrees) /
          180;
  final previousScore =
      1 -
      shortestAngleDistanceDegrees(headingDegrees, previousHeadingDegrees) /
          180;

  return HeadingCandidateScore(
    headingDegrees: normalizeDegrees(headingDegrees),
    label: label,
    score: desiredScore * 0.55 + observedScore * 0.35 + previousScore * 0.1,
  );
}
