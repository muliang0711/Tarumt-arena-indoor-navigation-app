import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog_parser.dart';

void main() {
  test('parses the complete bundled validation capture', () async {
    final source = await File(
      'assets/positioning/wifiscans-15Jul2026.validation.json',
    ).readAsString();

    final catalog = parseWifiValidationCatalogJson(source);

    expect(catalog.samples, hasLength(130));
    expect(catalog.samplesByLocation, hasLength(13));
    expect(catalog.samplesFor('node-1'), hasLength(10));
    expect(catalog.samplesFor('node-1').first.scanId, 1);
    expect(catalog.samplesFor('node-1').first.readings, hasLength(53));
    expect(
      catalog.samplesFor('node-1').first.readings.first.bssid,
      '10:3F:8C:D6:D8:E0',
    );
    expect(
      catalog.samplesFor('node-1').first.readings.first.frequencyMhz,
      5220,
    );
    for (final samples in catalog.samplesByLocation.values) {
      expect(samples, hasLength(10));
    }
  });

  test('rejects malformed validation contracts', () {
    const valid = '''
      [{
        "timestamp": 1,
        "location_id": "node-1",
        "scan_id": 1,
        "orientation": "unknown",
        "session_id": "session",
        "AP_list": [{
          "bssid": "AA:BB:CC:DD:EE:FF",
          "rssi": -55,
          "channel": 2412
        }]
      }]
    ''';
    expect(parseWifiValidationCatalogJson(valid).samples, hasLength(1));
    expect(() => parseWifiValidationCatalogJson('[]'), throwsFormatException);
    expect(
      () => parseWifiValidationCatalogJson(
        valid.replaceFirst('"rssi": -55', '"rssi": 12'),
      ),
      throwsFormatException,
    );
    expect(
      () => parseWifiValidationCatalogJson(
        valid.replaceFirst('"channel": 2412', '"channel": "2412"'),
      ),
      throwsFormatException,
    );
  });
}
