import 'dart:math' as math;

import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/navigation_input_policy.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';

const _defaultBufferSize = 6;

DerivedEstimateBuffer createDerivedEstimateBuffer({
  int maxSize = _defaultBufferSize,
}) {
  return DerivedEstimateBuffer(
    acceptedEstimates: const <DerivedNavigationEstimate>[],
    droppedEstimateCount: 0,
    maxSize: maxSize,
  );
}

DerivedNavigationEstimate? getLatestDerivedEstimate(
  DerivedEstimateBuffer buffer,
) {
  return buffer.acceptedEstimates.lastOrNull;
}

DerivedEstimateIngestResult ingestDerivedEstimate({
  required DerivedEstimateBuffer buffer,
  required DerivedNavigationEstimate estimate,
  NavigationInputPolicy policy = navigationInputPolicy,
}) {
  final accepted = shouldAcceptDerivedEstimate(
    nextEstimate: estimate,
    previousEstimate: getLatestDerivedEstimate(buffer),
    policy: policy,
  );
  if (!accepted) {
    return DerivedEstimateIngestResult(
      accepted: false,
      acceptedEstimate: null,
      buffer: DerivedEstimateBuffer(
        acceptedEstimates: buffer.acceptedEstimates,
        droppedEstimateCount: buffer.droppedEstimateCount + 1,
        maxSize: buffer.maxSize,
      ),
      reason: DerivedEstimateIngestReason.rateLimited,
    );
  }

  final allEstimates = <DerivedNavigationEstimate>[
    ...buffer.acceptedEstimates,
    estimate,
  ];
  final acceptedEstimates = _javascriptSlice(allEstimates, -buffer.maxSize);
  return DerivedEstimateIngestResult(
    accepted: true,
    acceptedEstimate: estimate,
    buffer: DerivedEstimateBuffer(
      acceptedEstimates: acceptedEstimates,
      droppedEstimateCount: buffer.droppedEstimateCount,
      maxSize: buffer.maxSize,
    ),
    reason: DerivedEstimateIngestReason.accepted,
  );
}

List<DerivedNavigationEstimate> _javascriptSlice(
  List<DerivedNavigationEstimate> estimates,
  int start,
) {
  final normalizedStart = start < 0
      ? math.max(estimates.length + start, 0)
      : math.min(start, estimates.length);
  return estimates.sublist(normalizedStart);
}
