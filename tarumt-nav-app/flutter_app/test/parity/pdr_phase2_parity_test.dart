import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/pdr_pipeline.dart';

import '../support/json_parity.dart';
import 'pdr_result_json.dart';
import 'phase2_fixture.dart';

void main() {
  test('replays all Phase 2 PDR cases against the TypeScript golden', () {
    final fixture = loadPhase2Fixture();
    final golden = loadPhase2Golden();
    final actual = fixture.pdrCases
        .map(
          (parityCase) => <String, Object?>{
            'description': parityCase.description,
            'id': parityCase.id,
            'result': pdrResultToJson(
              runPdrPipeline(
                config: parityCase.config,
                desiredHeadingDegrees: parityCase.desiredHeadingDegrees,
                nowMs: parityCase.nowMs,
                pixelsPerMeter: parityCase.pixelsPerMeter,
                previousState: parityCase.previousState,
                samples: parityCase.samples,
              ),
            ),
          },
        )
        .toList(growable: false);
    final mismatches = compareParityJson(
      actual,
      golden['pdr'],
      tolerance: ParityTolerance(
        absolute: fixture.tolerance.absolute,
        relative: fixture.tolerance.relative,
      ),
    );

    expect(mismatches, isEmpty, reason: mismatches.take(20).join('\n'));
  });
}
