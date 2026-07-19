import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

final class TransientMotionBatch {
  TransientMotionBatch({
    required List<MotionInputSample> acceptedSamples,
    required this.droppedSampleCount,
  }) : acceptedSamples = List.unmodifiable(acceptedSamples);

  final List<MotionInputSample> acceptedSamples;
  final int droppedSampleCount;
}

TransientMotionBatch createTransientMotionBatch({
  required PdrPipelineConfig config,
  required int nowMs,
  required List<MotionInputSample> samples,
}) {
  final batchStartMs = nowMs - config.batchWindowMs;
  final indexedFreshSamples = <({int index, MotionInputSample sample})>[];

  for (var index = 0; index < samples.length; index += 1) {
    final sample = samples[index];
    if (sample.timestampMs >= batchStartMs &&
        sample.timestampMs <= nowMs &&
        nowMs - sample.timestampMs <= config.maxBatchAgeMs) {
      indexedFreshSamples.add((index: index, sample: sample));
    }
  }

  // ECMAScript Array.sort is stable. Keep the original index as an explicit
  // tie-breaker so equal timestamps retain their TypeScript input order.
  indexedFreshSamples.sort((left, right) {
    final timestampOrder = left.sample.timestampMs.compareTo(
      right.sample.timestampMs,
    );
    return timestampOrder != 0 ? timestampOrder : left.index - right.index;
  });

  final firstAcceptedIndex =
      indexedFreshSamples.length > config.maxSamplesPerBatch
      ? indexedFreshSamples.length - config.maxSamplesPerBatch
      : 0;
  final acceptedSamples = indexedFreshSamples
      .skip(firstAcceptedIndex)
      .map((entry) => entry.sample)
      .toList(growable: false);

  return TransientMotionBatch(
    acceptedSamples: acceptedSamples,
    droppedSampleCount: samples.length - acceptedSamples.length,
  );
}
