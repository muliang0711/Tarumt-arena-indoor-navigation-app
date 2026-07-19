import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui';

import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';
import 'package:share_plus/share_plus.dart';

enum EdgeDocumentShareStatus { success, dismissed, unavailable }

final class EdgeDocumentShareRequest {
  const EdgeDocumentShareRequest({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String mimeType;
}

abstract interface class EdgeDocumentShareGateway {
  Future<EdgeDocumentShareStatus> share(EdgeDocumentShareRequest request);
}

typedef SharePlusInvoker = Future<ShareResult> Function(ShareParams params);

final class SharePlusEdgeDocumentGateway implements EdgeDocumentShareGateway {
  SharePlusEdgeDocumentGateway({
    SharePlusInvoker? shareInvoker,
    Rect sharePositionOrigin = const Rect.fromLTWH(0, 0, 1, 1),
  }) : _shareInvoker = shareInvoker ?? SharePlus.instance.share,
       _sharePositionOrigin = sharePositionOrigin {
    if (sharePositionOrigin.isEmpty) {
      throw ArgumentError.value(
        sharePositionOrigin,
        'sharePositionOrigin',
        'must be non-empty for iPad share sheets',
      );
    }
  }

  final SharePlusInvoker _shareInvoker;
  final Rect _sharePositionOrigin;

  @override
  Future<EdgeDocumentShareStatus> share(
    EdgeDocumentShareRequest request,
  ) async {
    final file = XFile.fromData(request.bytes, mimeType: request.mimeType);
    final result = await _shareInvoker(
      ShareParams(
        files: <XFile>[file],
        fileNameOverrides: <String>[request.fileName],
        sharePositionOrigin: _sharePositionOrigin,
      ),
    );
    return switch (result.status) {
      ShareResultStatus.success => EdgeDocumentShareStatus.success,
      ShareResultStatus.dismissed => EdgeDocumentShareStatus.dismissed,
      ShareResultStatus.unavailable => EdgeDocumentShareStatus.unavailable,
    };
  }
}

final class EdgeDocumentExportException implements Exception {
  const EdgeDocumentExportException(this.message);

  final String message;

  @override
  String toString() => 'EdgeDocumentExportException: $message';
}

final class ShareEdgeDocumentExporter implements EdgeDocumentExporter {
  ShareEdgeDocumentExporter({EdgeDocumentShareGateway? shareGateway})
    : _shareGateway = shareGateway ?? SharePlusEdgeDocumentGateway();

  final EdgeDocumentShareGateway _shareGateway;

  @override
  Future<void> export(EdgeDocumentExportRequest request) async {
    final result = await _shareGateway.share(
      EdgeDocumentShareRequest(
        bytes: Uint8List.fromList(utf8.encode(request.jsonBody)),
        fileName: request.fileName,
        mimeType: request.mimeType,
      ),
    );
    switch (result) {
      case EdgeDocumentShareStatus.success:
        return;
      case EdgeDocumentShareStatus.dismissed:
        throw const EdgeDocumentExportException('Share was dismissed.');
      case EdgeDocumentShareStatus.unavailable:
        throw const EdgeDocumentExportException('Sharing is unavailable.');
    }
  }
}
