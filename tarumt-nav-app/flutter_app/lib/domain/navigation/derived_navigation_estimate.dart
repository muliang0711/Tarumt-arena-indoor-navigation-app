enum DerivedNavigationEstimateSource {
  debugReplay('debug-replay'),
  externalDerived('external-derived'),
  manualTest('manual-test'),
  pdrSummary('pdr-summary');

  const DerivedNavigationEstimateSource(this.wireValue);
  final String wireValue;
}

final class DerivedNavigationEstimate {
  const DerivedNavigationEstimate({
    required this.confidence,
    required this.headingDegrees,
    required this.source,
    required this.timestampMs,
    required this.x,
    required this.y,
  });

  final double confidence;
  final double headingDegrees;
  final DerivedNavigationEstimateSource source;
  final int timestampMs;
  final double x;
  final double y;
}
