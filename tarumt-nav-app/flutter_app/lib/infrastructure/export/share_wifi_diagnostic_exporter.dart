import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui';

import 'package:indoor_navigation/application/ports/export/wifi_diagnostic_exporter.dart';
import 'package:share_plus/share_plus.dart';

typedef WifiDiagnosticShareInvoker =
    Future<ShareResult> Function(ShareParams params);

final class ShareWifiDiagnosticExporter implements WifiDiagnosticExporter {
  ShareWifiDiagnosticExporter({WifiDiagnosticShareInvoker? shareInvoker})
    : _shareInvoker = shareInvoker ?? SharePlus.instance.share;

  final WifiDiagnosticShareInvoker _shareInvoker;

  @override
  Future<WifiDiagnosticExportStatus> export(
    WifiDiagnosticExportRequest request,
  ) async {
    final file = XFile.fromData(
      Uint8List.fromList(utf8.encode(request.jsonBody)),
      mimeType: 'application/json',
    );
    final result = await _shareInvoker(
      ShareParams(
        files: <XFile>[file],
        fileNameOverrides: <String>[request.fileName],
        sharePositionOrigin: const Rect.fromLTWH(0, 0, 1, 1),
        subject: 'Indoor Navigation Wi-Fi diagnostics',
      ),
    );
    return switch (result.status) {
      ShareResultStatus.success => WifiDiagnosticExportStatus.success,
      ShareResultStatus.dismissed => WifiDiagnosticExportStatus.dismissed,
      ShareResultStatus.unavailable => WifiDiagnosticExportStatus.unavailable,
    };
  }
}
