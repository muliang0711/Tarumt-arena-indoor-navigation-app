import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

/// One hardware-independent access-point value entered by a tester.
final class ManualWifiAccessPointReading {
  factory ManualWifiAccessPointReading({
    required String bssid,
    int frequencyMhz = 2412,
    required int rssi,
    String? ssid,
  }) {
    final validated = WifiAccessPointReading(
      bssid: bssid,
      frequencyMhz: frequencyMhz,
      observedAtMs: 0,
      rssi: rssi,
      ssid: ssid,
    );
    return ManualWifiAccessPointReading._(
      bssid: validated.bssid,
      frequencyMhz: validated.frequencyMhz,
      rssi: validated.rssi,
      ssid: validated.ssid,
    );
  }

  const ManualWifiAccessPointReading._({
    required this.bssid,
    required this.frequencyMhz,
    required this.rssi,
    required this.ssid,
  });

  final String bssid;
  final int frequencyMhz;
  final int rssi;
  final String? ssid;
}

/// Makes manual readings available to both the Test Lab and map positioning.
abstract interface class ManualWifiScanController {
  List<ManualWifiAccessPointReading> get readings;

  void replaceReadings(List<ManualWifiAccessPointReading> readings);

  void clearReadings();
}
