import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

List<MotionInputSample> createMockMotionBatch({
  required double desiredHeadingDegrees,
  required int nowMs,
}) {
  final headings = <double>[
    desiredHeadingDegrees - 6,
    desiredHeadingDegrees + 4,
    desiredHeadingDegrees + 9,
    desiredHeadingDegrees - 3,
  ];

  return List.unmodifiable(
    List.generate(headings.length, (index) {
      return MotionInputSample(
        acceleration: MotionVector(x: index == 1 ? 0.4 : 1.45, y: 0, z: 0),
        headingDegrees: headings[index],
        timestampMs: nowMs - (headings.length - index) * 18,
      );
    }),
  );
}
