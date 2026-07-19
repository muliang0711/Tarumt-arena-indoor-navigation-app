import 'dart:collection';

import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';

/// Deterministic exporter whose scripted outcomes are consumed FIFO.
final class FakeEdgeDocumentExporter implements EdgeDocumentExporter {
  final List<EdgeDocumentExportRequest> _requests = [];
  final Queue<Object?> _outcomes = Queue<Object?>();

  List<EdgeDocumentExportRequest> get requests =>
      List<EdgeDocumentExportRequest>.unmodifiable(_requests);

  void enqueueSuccess() {
    _outcomes.add(null);
  }

  void enqueueFailure(Object error) {
    _outcomes.add(error);
  }

  void clearRequests() {
    _requests.clear();
  }

  @override
  Future<void> export(EdgeDocumentExportRequest request) async {
    _requests.add(request);
    if (_outcomes.isEmpty) {
      return;
    }
    final error = _outcomes.removeFirst();
    if (error != null) {
      throw error;
    }
  }
}
