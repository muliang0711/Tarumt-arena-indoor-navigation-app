/// Exact document passed to an infrastructure adapter for export.
final class EdgeDocumentExportRequest {
  const EdgeDocumentExportRequest({
    required this.fileName,
    required this.jsonBody,
    required this.mimeType,
  });

  final String fileName;
  final String jsonBody;
  final String mimeType;
}

/// Exports an already-serialized Edge Editor document.
///
/// The future completes only when the adapter reports success and completes
/// with the adapter's error on failure. Presentation state is kept outside the
/// port.
abstract interface class EdgeDocumentExporter {
  Future<void> export(EdgeDocumentExportRequest request);
}
