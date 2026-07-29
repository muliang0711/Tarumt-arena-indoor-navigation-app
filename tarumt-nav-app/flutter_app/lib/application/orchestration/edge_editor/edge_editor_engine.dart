import 'dart:async';

import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_state.dart';
import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_graph_edge_model.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

const edgeEditorSourceMap = 'demo_1.tmj';
const edgeEditorExportFileName = 'demo_1.edges.json';
const edgeEditorExportMimeType = 'application/json';

enum EdgeFieldProperty { key, value }

final class EdgeEditorEngine {
  EdgeEditorEngine(this._exporter);

  final EdgeDocumentExporter _exporter;
  final StreamController<EdgeEditorState> _states =
      StreamController<EdgeEditorState>.broadcast(sync: true);

  EdgeEditorState _state = EdgeEditorState.initial();
  var _exportGeneration = 0;
  var _isDisposed = false;

  EdgeEditorState get state => _state;
  Stream<EdgeEditorState> get states => _states.stream;

  void initialize({
    required List<RouteGraphEdgeExport> edges,
    required List<OverlayRouteNode> routeNodes,
  }) {
    _throwIfDisposed();
    _exportGeneration += 1;
    _replace(
      edges: edges,
      routeNodes: routeNodes,
      selectedNodeIds: const [],
      draftPairKey: '',
      edgeId: '',
      distance: '',
      fields: const [],
      isInitialized: true,
      exportStatus: EdgeExportStatus.idle,
      exportError: null,
    );
  }

  void selectRouteNode(String nodeId) {
    _requireInitialized();
    if (!_state.routeNodes.any((node) => node.nodeId == nodeId)) {
      return;
    }

    final current = _state.selectedNodeIds;
    final List<String> selectedNodeIds;
    if (current.isEmpty) {
      selectedNodeIds = [nodeId];
    } else if (current.length == 1) {
      selectedNodeIds = current.first == nodeId
          ? const []
          : [current.first, nodeId];
    } else {
      selectedNodeIds = [nodeId];
    }
    _applySelection(selectedNodeIds);
  }

  /// Mirrors App.tsx mode changes: only selection/pair identity are cleared.
  void clearSelection() {
    _requireInitialized();
    _applySelection(const []);
  }

  void setEdgeId(String edgeId) {
    _requireInitialized();
    _replace(edgeId: edgeId);
  }

  void setDistance(String distance) {
    _requireInitialized();
    _replace(distance: distance);
  }

  void addEdgeField() {
    _requireInitialized();
    _replace(
      fields: [
        ..._state.fields,
        const EdgeFieldDraft(key: '', value: ''),
      ],
    );
  }

  void updateEdgeField(int index, EdgeFieldProperty property, String value) {
    _requireInitialized();
    if (index < 0 || index >= _state.fields.length) {
      return;
    }
    final fields = _state.fields.indexed
        .map((entry) {
          final field = entry.$2;
          if (entry.$1 != index) {
            return field;
          }
          return switch (property) {
            EdgeFieldProperty.key => EdgeFieldDraft(
              key: value,
              value: field.value,
            ),
            EdgeFieldProperty.value => EdgeFieldDraft(
              key: field.key,
              value: value,
            ),
          };
        })
        .toList(growable: false);
    _replace(fields: fields);
  }

  void removeEdgeField(int index) {
    _requireInitialized();
    if (index < 0 || index >= _state.fields.length) {
      return;
    }
    _replace(
      fields: _state.fields.indexed
          .where((entry) => entry.$1 != index)
          .map((entry) => entry.$2)
          .toList(growable: false),
    );
  }

  bool saveEdge() {
    _requireInitialized();
    final fromNode = _state.fromNode;
    final toNode = _state.toNode;
    final parsedDistance = _parseJavaScriptNumber(_state.distance);
    if (fromNode == null ||
        toNode == null ||
        !_state.canSave ||
        parsedDistance == null) {
      return false;
    }

    final edge = createRouteGraphEdge(
      CreateRouteGraphEdgeInput(
        distance: parsedDistance,
        fields: _state.fields,
        from: fromNode.nodeId,
        id: _state.edgeId,
        to: toNode.nodeId,
      ),
    );
    _replace(
      edges: [..._state.edges.where((current) => current.id != edge.id), edge],
      selectedNodeIds: const [],
      draftPairKey: '',
    );
    return true;
  }

  void removeEdge(String edgeId) {
    _requireInitialized();
    _replace(
      edges: _state.edges
          .where((edge) => edge.id != edgeId)
          .toList(growable: false),
    );
  }

  Future<void> exportDocument() async {
    _requireInitialized();
    _exportGeneration += 1;
    final generation = _exportGeneration;
    final json = _state.serializedDocument;
    _replace(exportStatus: EdgeExportStatus.exporting, exportError: null);
    try {
      await _exporter.export(
        EdgeDocumentExportRequest(
          fileName: edgeEditorExportFileName,
          jsonBody: json,
          mimeType: edgeEditorExportMimeType,
        ),
      );
      if (_isCurrentExport(generation)) {
        _replace(exportStatus: EdgeExportStatus.success, exportError: null);
      }
    } catch (error) {
      if (_isCurrentExport(generation)) {
        _replace(exportStatus: EdgeExportStatus.error, exportError: error);
      }
      rethrow;
    }
  }

  void _applySelection(List<String> selectedNodeIds) {
    if (selectedNodeIds.length < 2) {
      _replace(selectedNodeIds: selectedNodeIds, draftPairKey: '');
      return;
    }
    final from = _nodeById(selectedNodeIds[0]);
    final to = _nodeById(selectedNodeIds[1]);
    if (from == null || to == null) {
      _replace(selectedNodeIds: selectedNodeIds, draftPairKey: '');
      return;
    }
    final pairKey = '${from.nodeId}->${to.nodeId}';
    if (pairKey == _state.draftPairKey) {
      _replace(selectedNodeIds: selectedNodeIds);
      return;
    }
    _replace(
      selectedNodeIds: selectedNodeIds,
      draftPairKey: pairKey,
      edgeId: 'edge-${from.nodeId}-${to.nodeId}',
      distance: _formatDistance(createNodeDistance(from, to)),
      fields: const [],
    );
  }

  OverlayRouteNode? _nodeById(String nodeId) {
    for (final node in _state.routeNodes) {
      if (node.nodeId == nodeId) {
        return node;
      }
    }
    return null;
  }

  void _replace({
    List<RouteGraphEdgeExport>? edges,
    List<OverlayRouteNode>? routeNodes,
    List<String>? selectedNodeIds,
    String? draftPairKey,
    String? edgeId,
    String? distance,
    List<EdgeFieldDraft>? fields,
    bool? isInitialized,
    EdgeExportStatus? exportStatus,
    Object? exportError = _unchanged,
  }) {
    final nextEdges = edges ?? _state.edges;
    final nextRouteNodes = routeNodes ?? _state.routeNodes;
    final nextSelectedNodeIds = selectedNodeIds ?? _state.selectedNodeIds;
    final nextEdgeId = edgeId ?? _state.edgeId;
    final nextDistance = distance ?? _state.distance;
    final nextFields = fields ?? _state.fields;
    final initialized = isInitialized ?? _state.isInitialized;
    final canSave =
        initialized &&
        nextSelectedNodeIds.length >= 2 &&
        nextEdgeId.trim().isNotEmpty &&
        (_parseJavaScriptNumber(nextDistance)?.isFinite ?? false);
    _emit(
      EdgeEditorState(
        canSave: canSave,
        distance: nextDistance,
        draftPairKey: draftPairKey ?? _state.draftPairKey,
        edgeId: nextEdgeId,
        edgeSegments: createEdgePathSegments(nextEdges, nextRouteNodes),
        edges: nextEdges,
        exportError: identical(exportError, _unchanged)
            ? _state.exportError
            : exportError,
        exportStatus: exportStatus ?? _state.exportStatus,
        fields: nextFields,
        isInitialized: initialized,
        routeNodes: nextRouteNodes,
        selectedNodeIds: nextSelectedNodeIds,
        serializedDocument: stringifyRouteGraphEdgeDocument(
          nextEdges,
          edgeEditorSourceMap,
        ),
      ),
    );
  }

  void _emit(EdgeEditorState nextState) {
    if (_isDisposed) {
      return;
    }
    _state = nextState;
    _states.add(nextState);
  }

  bool _isCurrentExport(int generation) =>
      !_isDisposed && generation == _exportGeneration;

  void _requireInitialized() {
    _throwIfDisposed();
    if (!_state.isInitialized) {
      throw StateError('EdgeEditorEngine has not been initialized.');
    }
  }

  void _throwIfDisposed() {
    if (_isDisposed) {
      throw StateError('EdgeEditorEngine has been disposed.');
    }
  }

  Future<void> dispose() async {
    if (_isDisposed) {
      return;
    }
    _isDisposed = true;
    _exportGeneration += 1;
    await _states.close();
  }
}

const Object _unchanged = Object();

String _formatDistance(double value) {
  if (value == value.truncateToDouble()) {
    return value.toInt().toString();
  }
  return value.toString();
}

double? _parseJavaScriptNumber(String source) {
  final value = source.trim();
  if (value.isEmpty) {
    return 0;
  }
  if (value.startsWith('0x') || value.startsWith('0X')) {
    return int.tryParse(value.substring(2), radix: 16)?.toDouble();
  }
  if (value.startsWith('0b') || value.startsWith('0B')) {
    return int.tryParse(value.substring(2), radix: 2)?.toDouble();
  }
  if (value.startsWith('0o') || value.startsWith('0O')) {
    return int.tryParse(value.substring(2), radix: 8)?.toDouble();
  }
  return double.tryParse(value);
}
