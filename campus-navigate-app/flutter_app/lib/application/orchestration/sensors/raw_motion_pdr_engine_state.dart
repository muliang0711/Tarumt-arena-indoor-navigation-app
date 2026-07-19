import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

/// Immutable observable state for [RawMotionPdrEngine].
///
/// Raw samples deliberately never cross this boundary.
final class RawMotionPdrEngineState {
  const RawMotionPdrEngineState({
    required this.lastPdrResult,
    required this.stats,
    required this.status,
  });

  final PdrPipelineResult? lastPdrResult;
  final RawMotionBatchStats stats;
  final RawMotionConsumerStatus status;
}
