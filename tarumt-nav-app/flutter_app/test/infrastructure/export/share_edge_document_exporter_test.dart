import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';
import 'package:indoor_navigation/infrastructure/export/share_edge_document_exporter.dart';
import 'package:share_plus/share_plus.dart';

void main() {
  const exportRequest = EdgeDocumentExportRequest(
    fileName: 'demo_1.edges.json',
    jsonBody: '{"label":"走廊"}\n',
    mimeType: 'application/json',
  );

  test('export sends exact UTF-8 bytes, file name, and MIME type', () async {
    final gateway = _FakeShareGateway(EdgeDocumentShareStatus.success);
    final exporter = ShareEdgeDocumentExporter(shareGateway: gateway);

    await exporter.export(exportRequest);

    expect(gateway.requests, hasLength(1));
    final request = gateway.requests.single;
    expect(request.bytes, utf8.encode(exportRequest.jsonBody));
    expect(request.fileName, exportRequest.fileName);
    expect(request.mimeType, exportRequest.mimeType);
  });

  test('export completes only for a successful share result', () async {
    final successExporter = ShareEdgeDocumentExporter(
      shareGateway: _FakeShareGateway(EdgeDocumentShareStatus.success),
    );
    final dismissedExporter = ShareEdgeDocumentExporter(
      shareGateway: _FakeShareGateway(EdgeDocumentShareStatus.dismissed),
    );
    final unavailableExporter = ShareEdgeDocumentExporter(
      shareGateway: _FakeShareGateway(EdgeDocumentShareStatus.unavailable),
    );

    await expectLater(successExporter.export(exportRequest), completes);
    await expectLater(
      dismissedExporter.export(exportRequest),
      throwsA(
        isA<EdgeDocumentExportException>().having(
          (EdgeDocumentExportException error) => error.message,
          'message',
          'Share was dismissed.',
        ),
      ),
    );
    await expectLater(
      unavailableExporter.export(exportRequest),
      throwsA(
        isA<EdgeDocumentExportException>().having(
          (EdgeDocumentExportException error) => error.message,
          'message',
          'Sharing is unavailable.',
        ),
      ),
    );
  });

  test('gateway exceptions surface unchanged', () async {
    final error = StateError('platform failed');
    final exporter = ShareEdgeDocumentExporter(
      shareGateway: _FakeShareGateway.failure(error),
    );

    await expectLater(exporter.export(exportRequest), throwsA(same(error)));
  });

  test(
    'SharePlus gateway creates XFile and supplies a non-empty origin',
    () async {
      ShareParams? capturedParams;
      final gateway = SharePlusEdgeDocumentGateway(
        shareInvoker: (ShareParams params) async {
          capturedParams = params;
          return const ShareResult(
            'com.example.target',
            ShareResultStatus.success,
          );
        },
      );

      final result = await gateway.share(
        EdgeDocumentShareRequest(
          bytes: Uint8List.fromList(utf8.encode(exportRequest.jsonBody)),
          fileName: exportRequest.fileName,
          mimeType: exportRequest.mimeType,
        ),
      );

      expect(result, EdgeDocumentShareStatus.success);
      final params = capturedParams!;
      expect(params.fileNameOverrides, <String>[exportRequest.fileName]);
      expect(params.sharePositionOrigin, isNotNull);
      expect(params.sharePositionOrigin!.isEmpty, isFalse);
      expect(params.files, hasLength(1));
      expect(
        await params.files!.single.readAsBytes(),
        utf8.encode(exportRequest.jsonBody),
      );
      expect(params.files!.single.mimeType, exportRequest.mimeType);
    },
  );

  test('SharePlus gateway maps dismissed and unavailable outcomes', () async {
    final results = <ShareResult>[
      const ShareResult('', ShareResultStatus.dismissed),
      ShareResult.unavailable,
    ];
    final gateway = SharePlusEdgeDocumentGateway(
      shareInvoker: (ShareParams _) async => results.removeAt(0),
    );
    final request = EdgeDocumentShareRequest(
      bytes: Uint8List.fromList(utf8.encode('{}')),
      fileName: 'edges.json',
      mimeType: 'application/json',
    );

    expect(await gateway.share(request), EdgeDocumentShareStatus.dismissed);
    expect(await gateway.share(request), EdgeDocumentShareStatus.unavailable);
  });

  test('SharePlus gateway rejects an empty iPad origin', () {
    expect(
      () => SharePlusEdgeDocumentGateway(
        sharePositionOrigin: Rect.zero,
        shareInvoker: (ShareParams _) async => ShareResult.unavailable,
      ),
      throwsArgumentError,
    );
  });
}

final class _FakeShareGateway implements EdgeDocumentShareGateway {
  _FakeShareGateway(this._status) : _error = null;

  _FakeShareGateway.failure(this._error) : _status = null;

  final EdgeDocumentShareStatus? _status;
  final Object? _error;
  final List<EdgeDocumentShareRequest> requests = <EdgeDocumentShareRequest>[];

  @override
  Future<EdgeDocumentShareStatus> share(
    EdgeDocumentShareRequest request,
  ) async {
    requests.add(request);
    final error = _error;
    if (error != null) {
      throw error;
    }
    return _status!;
  }
}
