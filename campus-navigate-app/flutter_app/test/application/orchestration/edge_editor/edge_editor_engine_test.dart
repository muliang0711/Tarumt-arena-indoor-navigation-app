import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_engine.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_state.dart';
import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  test(
    'initializes immutable snapshots without owning navigation metrics',
    () async {
      final exporter = _ControlledEdgeDocumentExporter();
      final engine = EdgeEditorEngine(exporter);
      final states = <EdgeEditorState>[];
      final subscription = engine.states.listen(states.add);
      final initialEdge = _edge(
        id: 'existing',
        from: 'A',
        to: 'B',
        distance: 4,
      );

      engine.initialize(edges: [initialEdge], routeNodes: _nodes);

      expect(states, hasLength(1));
      expect(engine.state.isInitialized, isTrue);
      expect(engine.state.edges, [initialEdge]);
      expect(engine.state.edgeSegments, hasLength(1));
      expect(engine.state.exportStatus, EdgeExportStatus.idle);
      expect(() => engine.state.edges.add(initialEdge), throwsUnsupportedError);
      expect(() => engine.state.routeNodes.clear(), throwsUnsupportedError);
      expect(
        () => engine.state.selectedNodeIds.add('A'),
        throwsUnsupportedError,
      );
      expect(
        () => engine.state.fields.add(const EdgeFieldDraft(key: '', value: '')),
        throwsUnsupportedError,
      );
      await engine.dispose();
      await subscription.cancel();
    },
  );

  test(
    'preserves App.tsx selection sequence and resets drafts per pair',
    () async {
      final engine = EdgeEditorEngine(_ControlledEdgeDocumentExporter());
      engine.initialize(edges: const [], routeNodes: _nodes);

      engine.selectRouteNode('unknown');
      expect(engine.state.selectedNodeIds, isEmpty);
      engine.selectRouteNode('A');
      expect(engine.state.selectedNodeIds, ['A']);
      engine.selectRouteNode('A');
      expect(engine.state.selectedNodeIds, isEmpty);

      engine.selectRouteNode('A');
      engine.selectRouteNode('B');
      expect(engine.state.selectedNodeIds, ['A', 'B']);
      expect(engine.state.draftPairKey, 'A->B');
      expect(engine.state.edgeId, 'edge-A-B');
      expect(engine.state.distance, '5');
      expect(engine.state.canSave, isTrue);
      engine.setEdgeId('   ');
      expect(engine.state.canSave, isFalse);
      engine.setEdgeId('edge-A-B');
      expect(engine.state.canSave, isTrue);

      engine.addEdgeField();
      engine.updateEdgeField(0, EdgeFieldProperty.key, 'floor');
      engine.updateEdgeField(0, EdgeFieldProperty.value, '2');
      engine.clearSelection();
      expect(engine.state.selectedNodeIds, isEmpty);
      expect(engine.state.draftPairKey, '');
      expect(engine.state.edgeId, 'edge-A-B');
      expect(engine.state.distance, '5');
      expect(engine.state.fields.single.key, 'floor');

      engine.selectRouteNode('A');
      engine.selectRouteNode('B');
      engine.addEdgeField();
      engine.updateEdgeField(0, EdgeFieldProperty.key, 'floor');
      engine.selectRouteNode('C');
      expect(engine.state.selectedNodeIds, ['C']);
      expect(engine.state.draftPairKey, '');
      expect(engine.state.fields.single.key, 'floor');

      engine.selectRouteNode('A');
      expect(engine.state.selectedNodeIds, ['C', 'A']);
      expect(engine.state.draftPairKey, 'C->A');
      expect(engine.state.edgeId, 'edge-C-A');
      expect(engine.state.distance, '10.77');
      expect(engine.state.fields, isEmpty);
      await engine.dispose();
    },
  );

  test(
    'supports every field edit path and saves replacement at document end',
    () async {
      final existing = _edge(id: 'replace-me', from: 'B', to: 'C', distance: 1);
      final keep = _edge(id: 'keep', from: 'A', to: 'C', distance: 2);
      final engine = EdgeEditorEngine(_ControlledEdgeDocumentExporter());
      engine.initialize(edges: [existing, keep], routeNodes: _nodes);
      engine.selectRouteNode('A');
      engine.selectRouteNode('B');
      engine.setEdgeId('  replace-me  ');
      engine.setDistance('12.345');
      engine.addEdgeField();
      engine.addEdgeField();
      engine.addEdgeField();
      engine.updateEdgeField(0, EdgeFieldProperty.key, 'floor');
      engine.updateEdgeField(0, EdgeFieldProperty.value, '2');
      engine.updateEdgeField(1, EdgeFieldProperty.key, 'accessible');
      engine.updateEdgeField(1, EdgeFieldProperty.value, 'true');
      engine.updateEdgeField(2, EdgeFieldProperty.key, 'distance');
      engine.updateEdgeField(2, EdgeFieldProperty.value, '999');
      engine.removeEdgeField(99);
      engine.removeEdgeField(2);

      expect(engine.saveEdge(), isTrue);

      expect(engine.state.edges.map((edge) => edge.id), ['keep', 'replace-me']);
      final saved = engine.state.edges.last;
      expect(saved.from, 'A');
      expect(saved.to, 'B');
      expect(saved.distance, 12.35);
      expect(saved.customFields, {'floor': 2, 'accessible': true});
      expect(engine.state.selectedNodeIds, isEmpty);
      expect(engine.state.draftPairKey, '');
      expect(engine.state.edgeSegments, hasLength(2));
      expect(engine.state.serializedDocument, endsWith('\n'));
      expect(
        engine.state.serializedDocument,
        contains('"sourceMap": "demo_1.tmj"'),
      );

      engine.removeEdge('keep');
      expect(engine.state.edges.map((edge) => edge.id), ['replace-me']);
      expect(engine.state.edgeSegments, hasLength(1));
      await engine.dispose();
    },
  );

  group('JavaScript Number canSave/save semantics', () {
    for (final testCase in <({String input, bool canSave, double? distance})>[
      (input: '', canSave: true, distance: 0),
      (input: '   ', canSave: true, distance: 0),
      (input: '0x10', canSave: true, distance: 16),
      (input: '0b11', canSave: true, distance: 3),
      (input: '0o10', canSave: true, distance: 8),
      (input: '-0', canSave: true, distance: -0.0),
      (input: 'Infinity', canSave: false, distance: null),
      (input: 'NaN', canSave: false, distance: null),
      (input: '1e309', canSave: false, distance: null),
      (input: '0x', canSave: false, distance: null),
    ]) {
      test('handles ${testCase.input.inspect}', () async {
        final engine = EdgeEditorEngine(_ControlledEdgeDocumentExporter());
        engine.initialize(edges: const [], routeNodes: _nodes);
        engine.selectRouteNode('A');
        engine.selectRouteNode('B');
        engine.setDistance(testCase.input);

        expect(engine.state.canSave, testCase.canSave);
        expect(engine.saveEdge(), testCase.canSave);
        if (testCase.distance != null) {
          final actual = engine.state.edges.single.distance;
          expect(actual, testCase.distance);
          if (testCase.input == '-0') {
            expect(actual.isNegative, isTrue);
          }
        }
        await engine.dispose();
      });
    }
  });

  test(
    'exports exact snapshots and only latest overlapping completion wins',
    () async {
      final exporter = _ControlledEdgeDocumentExporter();
      final firstCompletion = exporter.enqueue();
      final secondCompletion = exporter.enqueue();
      final thirdCompletion = exporter.enqueue();
      final engine = EdgeEditorEngine(exporter);
      final statuses = <EdgeExportStatus>[];
      final subscription = engine.states.listen(
        (state) => statuses.add(state.exportStatus),
      );
      engine.initialize(
        edges: [_edge(id: 'edge-1', from: 'A', to: 'B', distance: 5)],
        routeNodes: _nodes,
      );

      final first = engine.exportDocument();
      final second = engine.exportDocument();
      expect(exporter.requests, hasLength(2));
      for (final request in exporter.requests) {
        expect(request.fileName, 'demo_1.edges.json');
        expect(request.mimeType, 'application/json');
        expect(request.jsonBody, engine.state.serializedDocument);
      }
      final staleFailure = StateError('stale share failure');
      firstCompletion.completeError(staleFailure);
      await expectLater(first, throwsA(same(staleFailure)));
      expect(engine.state.exportStatus, EdgeExportStatus.exporting);

      secondCompletion.complete();
      await second;
      expect(engine.state.exportStatus, EdgeExportStatus.success);
      expect(engine.state.exportError, isNull);

      final third = engine.exportDocument();
      final currentFailure = StateError('share failed');
      thirdCompletion.completeError(currentFailure);
      await expectLater(third, throwsA(same(currentFailure)));
      expect(engine.state.exportStatus, EdgeExportStatus.error);
      expect(engine.state.exportError, same(currentFailure));
      expect(statuses, [
        EdgeExportStatus.idle,
        EdgeExportStatus.exporting,
        EdgeExportStatus.exporting,
        EdgeExportStatus.success,
        EdgeExportStatus.exporting,
        EdgeExportStatus.error,
      ]);
      await engine.dispose();
      await subscription.cancel();
    },
  );

  test(
    'dispose suppresses pending export completion and later operations',
    () async {
      final exporter = _ControlledEdgeDocumentExporter();
      final completion = exporter.enqueue();
      final engine = EdgeEditorEngine(exporter);
      final states = <EdgeEditorState>[];
      final subscription = engine.states.listen(states.add);
      engine.initialize(edges: const [], routeNodes: _nodes);
      final export = engine.exportDocument();
      final emissionCount = states.length;

      await engine.dispose();
      completion.complete();
      await export;

      expect(states, hasLength(emissionCount));
      expect(() => engine.selectRouteNode('A'), throwsStateError);
      expect(
        () => engine.initialize(edges: const [], routeNodes: _nodes),
        throwsStateError,
      );
      await engine.dispose();
      await subscription.cancel();
    },
  );
}

const _nodes = <OverlayRouteNode>[
  OverlayRouteNode(
    screenX: 0,
    screenY: 0,
    tiledX: 0,
    tiledY: 0,
    id: 1,
    nodeId: 'A',
    type: '',
  ),
  OverlayRouteNode(
    screenX: 3,
    screenY: 4,
    tiledX: 3,
    tiledY: 4,
    id: 2,
    nodeId: 'B',
    type: '',
  ),
  OverlayRouteNode(
    screenX: 10,
    screenY: 4,
    tiledX: 10,
    tiledY: 4,
    id: 3,
    nodeId: 'C',
    type: '',
  ),
];

RouteGraphEdgeExport _edge({
  required String id,
  required String from,
  required String to,
  required double distance,
}) {
  return RouteGraphEdgeExport(distance: distance, from: from, id: id, to: to);
}

final class _ControlledEdgeDocumentExporter implements EdgeDocumentExporter {
  final _completions = <Completer<void>>[];
  final requests = <EdgeDocumentExportRequest>[];
  var _index = 0;

  Completer<void> enqueue() {
    final completer = Completer<void>();
    _completions.add(completer);
    return completer;
  }

  @override
  Future<void> export(EdgeDocumentExportRequest request) {
    requests.add(request);
    return _completions[_index++].future;
  }
}

extension on String {
  String get inspect => this.isEmpty ? '<empty>' : '"$this"';
}
