import 'package:flutter_test/flutter_test.dart';

import 'phase2_fixture.dart';

void main() {
  test('loads all approved Phase 2 cases without changing the fixture', () {
    final fixture = loadPhase2Fixture();

    expect(fixture.schemaVersion, 1);
    expect(fixture.pdrCases, hasLength(14));
    expect(fixture.pdrCases.first.id, 'normal-forward-step');
    expect(fixture.pdrCases[4].samples.first.acceleration.x.isNaN, isTrue);
    expect(fixture.tolerance.absolute, 1e-6);
    expect(loadPhase2Golden()['routeMetrics'], isA<Map<String, Object?>>());
  });
}
