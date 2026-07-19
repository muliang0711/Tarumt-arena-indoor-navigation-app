import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

enum EdgeExportStatus { idle, exporting, success, error }

final class EdgeEditorState {
  EdgeEditorState({
    required this.canSave,
    required this.distance,
    required this.draftPairKey,
    required this.edgeId,
    required List<OverlayPathSegment> edgeSegments,
    required List<RouteGraphEdgeExport> edges,
    required List<EdgeFieldDraft> fields,
    required this.isInitialized,
    required List<OverlayRouteNode> routeNodes,
    required List<String> selectedNodeIds,
    required this.serializedDocument,
    this.exportError,
    this.exportStatus = EdgeExportStatus.idle,
  }) : edgeSegments = List.unmodifiable(edgeSegments),
       edges = List.unmodifiable(edges),
       fields = List.unmodifiable(fields),
       routeNodes = List.unmodifiable(routeNodes),
       selectedNodeIds = List.unmodifiable(selectedNodeIds);

  factory EdgeEditorState.initial() => EdgeEditorState(
    canSave: false,
    distance: '',
    draftPairKey: '',
    edgeId: '',
    edgeSegments: const [],
    edges: const [],
    fields: const [],
    isInitialized: false,
    routeNodes: const [],
    selectedNodeIds: const [],
    serializedDocument: '',
  );

  final bool canSave;
  final String distance;
  final String draftPairKey;
  final String edgeId;
  final List<OverlayPathSegment> edgeSegments;
  final List<RouteGraphEdgeExport> edges;
  final Object? exportError;
  final EdgeExportStatus exportStatus;
  final List<EdgeFieldDraft> fields;
  final bool isInitialized;
  final List<OverlayRouteNode> routeNodes;
  final List<String> selectedNodeIds;
  final String serializedDocument;

  OverlayRouteNode? get fromNode => _selectedNodeAt(0);
  OverlayRouteNode? get toNode => _selectedNodeAt(1);

  OverlayRouteNode? _selectedNodeAt(int index) {
    if (index >= selectedNodeIds.length) {
      return null;
    }
    final nodeId = selectedNodeIds[index];
    for (final node in routeNodes) {
      if (node.nodeId == nodeId) {
        return node;
      }
    }
    return null;
  }
}
