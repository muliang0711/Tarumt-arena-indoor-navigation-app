final class WifiDiagnosticExportRequest {
  const WifiDiagnosticExportRequest({
    required this.fileName,
    required this.jsonBody,
  });

  final String fileName;
  final String jsonBody;
}

enum WifiDiagnosticExportStatus { success, dismissed, unavailable }

abstract interface class WifiDiagnosticExporter {
  Future<WifiDiagnosticExportStatus> export(
    WifiDiagnosticExportRequest request,
  );
}
