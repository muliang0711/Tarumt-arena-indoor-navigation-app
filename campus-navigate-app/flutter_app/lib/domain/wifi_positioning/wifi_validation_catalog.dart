final class WifiValidationAccessPoint {
  const WifiValidationAccessPoint({
    required this.bssid,
    required this.frequencyMhz,
    required this.rssi,
  });

  final String bssid;
  final int frequencyMhz;
  final int rssi;
}

final class WifiValidationSample {
  WifiValidationSample({
    required this.locationId,
    required this.orientation,
    required List<WifiValidationAccessPoint> readings,
    required this.scanId,
    required this.sessionId,
    required this.timestampMs,
  }) : readings = List.unmodifiable(readings);

  final String locationId;
  final String orientation;
  final List<WifiValidationAccessPoint> readings;
  final int scanId;
  final String sessionId;
  final int timestampMs;
}

final class WifiValidationCatalog {
  WifiValidationCatalog(List<WifiValidationSample> samples)
    : samples = List.unmodifiable(samples),
      samplesByLocation = _groupSamples(samples) {
    if (samples.isEmpty) {
      throw ArgumentError.value(samples, 'samples', 'must not be empty');
    }
  }

  final List<WifiValidationSample> samples;
  final Map<String, List<WifiValidationSample>> samplesByLocation;

  List<WifiValidationSample> samplesFor(String locationId) =>
      samplesByLocation[locationId] ?? const [];
}

Map<String, List<WifiValidationSample>> _groupSamples(
  List<WifiValidationSample> samples,
) {
  final grouped = <String, List<WifiValidationSample>>{};
  for (final sample in samples) {
    (grouped[sample.locationId] ??= <WifiValidationSample>[]).add(sample);
  }
  return Map.unmodifiable({
    for (final entry in grouped.entries)
      entry.key: List<WifiValidationSample>.unmodifiable(entry.value),
  });
}
