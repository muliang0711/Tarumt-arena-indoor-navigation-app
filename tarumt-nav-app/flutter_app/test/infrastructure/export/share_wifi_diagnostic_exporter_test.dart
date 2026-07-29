import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/export/wifi_diagnostic_exporter.dart';
import 'package:indoor_navigation/infrastructure/export/share_wifi_diagnostic_exporter.dart';
import 'package:share_plus/share_plus.dart';

void main() {
  const request = WifiDiagnosticExportRequest(
    fileName: 'wifi-diagnostics.json',
    jsonBody: '{"eventCount":1}',
  );

  test('shares a named JSON file with exact UTF-8 content', () async {
    ShareParams? captured;
    final exporter = ShareWifiDiagnosticExporter(
      shareInvoker: (params) async {
        captured = params;
        return const ShareResult('target', ShareResultStatus.success);
      },
    );

    expect(await exporter.export(request), WifiDiagnosticExportStatus.success);

    final params = captured!;
    expect(params.fileNameOverrides, <String>[request.fileName]);
    expect(params.subject, 'Indoor Navigation Wi-Fi diagnostics');
    expect(params.files, hasLength(1));
    expect(params.files!.single.mimeType, 'application/json');
    expect(await params.files!.single.readAsString(), request.jsonBody);
  });

  test('maps dismissed and unavailable share results', () async {
    final results = <ShareResult>[
      const ShareResult('', ShareResultStatus.dismissed),
      ShareResult.unavailable,
    ];
    final exporter = ShareWifiDiagnosticExporter(
      shareInvoker: (_) async => results.removeAt(0),
    );

    expect(
      await exporter.export(request),
      WifiDiagnosticExportStatus.dismissed,
    );
    expect(
      await exporter.export(request),
      WifiDiagnosticExportStatus.unavailable,
    );
  });
}
