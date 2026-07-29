import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

MotionInputSample applyLiveHeadingToMotionSample({
  required double? liveHeadingDegrees,
  required MotionInputSample sample,
}) {
  if (liveHeadingDegrees == null) {
    return sample;
  }
  return MotionInputSample(
    acceleration: sample.acceleration,
    headingDegrees: liveHeadingDegrees,
    timestampMs: sample.timestampMs,
  );
}
