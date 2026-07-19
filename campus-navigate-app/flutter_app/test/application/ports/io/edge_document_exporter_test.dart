import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';

import '../../../support/fakes/fake_edge_document_exporter.dart';

void main() {
  test(
    'captures exact export values without parsing or rewriting JSON',
    () async {
      const request = EdgeDocumentExportRequest(
        fileName: 'demo_1.edges.json',
        jsonBody: '{\n  "kind": "route-graph-edges"\n}\n',
        mimeType: 'application/json',
      );
      final exporter = FakeEdgeDocumentExporter()..enqueueSuccess();

      await exporter.export(request);

      expect(exporter.requests, hasLength(1));
      expect(exporter.requests.single, same(request));
      expect(exporter.requests.single.fileName, 'demo_1.edges.json');
      expect(exporter.requests.single.mimeType, 'application/json');
      expect(
        exporter.requests.single.jsonBody,
        '{\n  "kind": "route-graph-edges"\n}\n',
      );
    },
  );

  test(
    'preserves multiple calls in order and surfaces scripted failure',
    () async {
      const first = EdgeDocumentExportRequest(
        fileName: 'first.json',
        jsonBody: 'one',
        mimeType: 'application/json',
      );
      const second = EdgeDocumentExportRequest(
        fileName: 'second.json',
        jsonBody: 'two',
        mimeType: 'application/vnd.example+json',
      );
      final failure = StateError('share sheet failed');
      final exporter = FakeEdgeDocumentExporter()
        ..enqueueSuccess()
        ..enqueueFailure(failure);

      await exporter.export(first);
      await expectLater(exporter.export(second), throwsA(same(failure)));

      expect(exporter.requests, <EdgeDocumentExportRequest>[first, second]);
    },
  );

  test('request snapshots are immutable and detached from later clearing', () {
    const request = EdgeDocumentExportRequest(
      fileName: 'edges.json',
      jsonBody: '{}\n',
      mimeType: 'application/json',
    );
    final exporter = FakeEdgeDocumentExporter();
    exporter.export(request);
    final snapshot = exporter.requests;

    expect(() => snapshot.add(request), throwsUnsupportedError);
    exporter.clearRequests();
    expect(exporter.requests, isEmpty);
    expect(snapshot, <EdgeDocumentExportRequest>[request]);
  });
}
