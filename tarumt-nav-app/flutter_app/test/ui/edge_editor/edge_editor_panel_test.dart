import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_engine.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_state.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/edge_editor/edge_editor.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('forwards the complete edit, save, delete, and export flow', (
    tester,
  ) async {
    final edgeIds = <String>[];
    final distances = <String>[];
    var addedFields = 0;
    final fieldUpdates = <(int, EdgeFieldProperty, String)>[];
    final removedFields = <int>[];
    var saveCalls = 0;
    final removedEdges = <String>[];
    var exportCalls = 0;

    await _pumpPanel(
      tester,
      state: _state(
        canSave: true,
        edgeId: 'edge-a-b',
        distance: '10',
        fields: const [EdgeFieldDraft(key: 'floor', value: '1')],
        edges: [_edge('edge-a-b')],
      ),
      onSetEdgeId: edgeIds.add,
      onSetEdgeDistance: distances.add,
      onAddEdgeField: () => addedFields += 1,
      onUpdateEdgeField: (index, property, value) {
        fieldUpdates.add((index, property, value));
      },
      onRemoveEdgeField: removedFields.add,
      onSaveEdge: () {
        saveCalls += 1;
        return true;
      },
      onRemoveEdge: removedEdges.add,
      onExportEdges: () async => exportCalls += 1,
    );

    await tester.enterText(
      find.byKey(EdgeEditorPanelKeys.edgeIdInput),
      'edge-updated',
    );
    await tester.enterText(
      find.byKey(EdgeEditorPanelKeys.distanceInput),
      '12.5',
    );
    await tester.tap(find.byKey(EdgeEditorPanelKeys.addField));
    await tester.enterText(
      find.byKey(EdgeEditorPanelKeys.fieldKeyInput(0)),
      'direction',
    );
    await tester.enterText(
      find.byKey(EdgeEditorPanelKeys.fieldValueInput(0)),
      'north',
    );
    await tester.tap(find.byKey(EdgeEditorPanelKeys.removeField(0)));
    await tester.tap(find.byKey(EdgeEditorPanelKeys.saveEdge));
    await tester.ensureVisible(
      find.byKey(EdgeEditorPanelKeys.removeEdge('edge-a-b')),
    );
    await tester.tap(find.byKey(EdgeEditorPanelKeys.removeEdge('edge-a-b')));
    await tester.ensureVisible(find.byKey(EdgeEditorPanelKeys.exportEdges));
    await tester.tap(find.byKey(EdgeEditorPanelKeys.exportEdges));
    await tester.pumpAndSettle();

    expect(edgeIds, ['edge-updated']);
    expect(distances, ['12.5']);
    expect(addedFields, 1);
    expect(fieldUpdates, [
      (0, EdgeFieldProperty.key, 'direction'),
      (0, EdgeFieldProperty.value, 'north'),
    ]);
    expect(removedFields, [0]);
    expect(saveCalls, 1);
    expect(removedEdges, ['edge-a-b']);
    expect(exportCalls, 1);
    expect(find.text('EDGE JSON exported.'), findsOneWidget);
  });

  testWidgets('synchronizes selection and controlled inputs on rebuild', (
    tester,
  ) async {
    await _pumpPanel(tester, state: _state(selectedNodeIds: const ['a']));
    expect(find.text('a -> choose another node'), findsOneWidget);

    await tester.enterText(
      find.byKey(EdgeEditorPanelKeys.edgeIdInput),
      'local edit',
    );
    final editable = tester.widget<EditableText>(
      find.descendant(
        of: find.byKey(EdgeEditorPanelKeys.edgeIdInput),
        matching: find.byType(EditableText),
      ),
    );
    editable.controller.selection = const TextSelection.collapsed(offset: 2);

    await _pumpPanel(
      tester,
      state: _state(
        edgeId: 'server-edge',
        distance: '22',
        selectedNodeIds: const ['a', 'b'],
        routeNodes: [_node(1, 'a'), _node(2, 'b')],
      ),
    );

    expect(find.text('a -> b'), findsOneWidget);
    expect(
      _controller(tester, EdgeEditorPanelKeys.edgeIdInput).text,
      'server-edge',
    );
    expect(_controller(tester, EdgeEditorPanelKeys.distanceInput).text, '22');

    final edgeController = _controller(tester, EdgeEditorPanelKeys.edgeIdInput);
    edgeController.selection = const TextSelection.collapsed(offset: 3);
    await _pumpPanel(
      tester,
      state: _state(
        edgeId: 'server-edge',
        distance: '22',
        selectedNodeIds: const ['a', 'b'],
        routeNodes: [_node(1, 'a'), _node(2, 'b')],
      ),
    );
    expect(edgeController.selection.baseOffset, 3);
  });

  testWidgets('reindexes field controllers after a field is removed', (
    tester,
  ) async {
    final updates = <(int, EdgeFieldProperty, String)>[];
    final removed = <int>[];
    await _pumpPanel(
      tester,
      state: _state(
        fields: const [
          EdgeFieldDraft(key: 'floor', value: '1'),
          EdgeFieldDraft(key: 'accessible', value: 'true'),
        ],
      ),
      onUpdateEdgeField: (index, property, value) {
        updates.add((index, property, value));
      },
      onRemoveEdgeField: removed.add,
    );

    await tester.tap(find.byKey(EdgeEditorPanelKeys.removeField(0)));
    expect(removed, [0]);

    await _pumpPanel(
      tester,
      state: _state(
        fields: const [EdgeFieldDraft(key: 'accessible', value: 'true')],
      ),
      onUpdateEdgeField: (index, property, value) {
        updates.add((index, property, value));
      },
      onRemoveEdgeField: removed.add,
    );

    expect(
      _controller(tester, EdgeEditorPanelKeys.fieldKeyInput(0)).text,
      'accessible',
    );
    expect(find.byKey(EdgeEditorPanelKeys.fieldKeyInput(1)), findsNothing);
    await tester.enterText(
      find.byKey(EdgeEditorPanelKeys.fieldValueInput(0)),
      'false',
    );
    expect(updates.last, (0, EdgeFieldProperty.value, 'false'));
  });

  testWidgets('disables save when the draft cannot be saved', (tester) async {
    var saveCalls = 0;
    await _pumpPanel(
      tester,
      state: _state(),
      onSaveEdge: () {
        saveCalls += 1;
        return true;
      },
    );

    final button = tester.widget<FilledButton>(
      find.byKey(EdgeEditorPanelKeys.saveEdge),
    );
    expect(button.onPressed, isNull);
    await tester.tap(find.byKey(EdgeEditorPanelKeys.saveEdge));
    expect(saveCalls, 0);
  });

  testWidgets('shows export progress and catches export failures', (
    tester,
  ) async {
    final completer = Completer<void>();
    await _pumpPanel(
      tester,
      state: _state(),
      onExportEdges: () => completer.future,
    );
    await tester.ensureVisible(find.byKey(EdgeEditorPanelKeys.exportEdges));
    await tester.tap(find.byKey(EdgeEditorPanelKeys.exportEdges));
    await tester.pump();

    expect(find.text('Exporting EDGE JSON…'), findsOneWidget);
    expect(
      tester
          .widget<TextButton>(find.byKey(EdgeEditorPanelKeys.exportEdges))
          .onPressed,
      isNull,
    );

    completer.complete();
    await tester.pumpAndSettle();
    expect(find.text('EDGE JSON exported.'), findsOneWidget);

    await _pumpPanel(
      tester,
      state: _state(),
      onExportEdges: () async => throw StateError('share unavailable'),
    );
    await tester.ensureVisible(find.byKey(EdgeEditorPanelKeys.exportEdges));
    await tester.tap(find.byKey(EdgeEditorPanelKeys.exportEdges));
    await tester.pumpAndSettle();

    expect(find.textContaining('share unavailable'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('is bounded and scrollable on a narrow iPhone-sized surface', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 568));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await _pumpPanel(
      tester,
      width: 320,
      height: 500,
      state: _state(
        fields: List.generate(
          4,
          (index) => EdgeFieldDraft(key: 'field$index', value: 'value$index'),
        ),
        edges: List.generate(4, (index) => _edge('edge-$index')),
      ),
    );

    expect(find.byKey(EdgeEditorPanelKeys.scrollView), findsOneWidget);
    final initialLayoutException = tester.takeException();
    expect(initialLayoutException, isNull);
    await tester.drag(
      find.byKey(EdgeEditorPanelKeys.scrollView),
      const Offset(0, -700),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(EdgeEditorPanelKeys.jsonOutput), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('exposes labels and read-only output to accessibility', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await _pumpPanel(
      tester,
      state: _state(
        canSave: true,
        edgeId: 'edge-a-b',
        distance: '10',
        fields: const [EdgeFieldDraft(key: 'floor', value: '1')],
      ),
    );

    expect(find.bySemanticsLabel('Edge ID'), findsOneWidget);
    expect(find.bySemanticsLabel('Distance'), findsOneWidget);
    expect(find.bySemanticsLabel('Field 1 key'), findsOneWidget);
    expect(find.bySemanticsLabel('Field 1 value'), findsOneWidget);
    expect(find.bySemanticsLabel('Read-only EDGE JSON'), findsOneWidget);
    expect(find.text('Save edge'), findsOneWidget);
    expect(find.text('Add field'), findsOneWidget);
    expect(find.text('Export'), findsOneWidget);
    semantics.dispose();
  });
}

Future<void> _pumpPanel(
  WidgetTester tester, {
  required EdgeEditorState state,
  double width = 760,
  double height = 620,
  ValueChanged<String>? onSetEdgeId,
  ValueChanged<String>? onSetEdgeDistance,
  VoidCallback? onAddEdgeField,
  UpdateEdgeFieldCallback? onUpdateEdgeField,
  ValueChanged<int>? onRemoveEdgeField,
  bool Function()? onSaveEdge,
  ValueChanged<String>? onRemoveEdge,
  Future<void> Function()? onExportEdges,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(
        body: Align(
          alignment: Alignment.topCenter,
          child: SizedBox(
            width: width,
            height: height,
            child: EdgeEditorPanel(
              state: state,
              onSetEdgeId: onSetEdgeId ?? (_) {},
              onSetEdgeDistance: onSetEdgeDistance ?? (_) {},
              onAddEdgeField: onAddEdgeField ?? () {},
              onUpdateEdgeField: onUpdateEdgeField ?? (_, _, _) {},
              onRemoveEdgeField: onRemoveEdgeField ?? (_) {},
              onSaveEdge: onSaveEdge ?? () => false,
              onRemoveEdge: onRemoveEdge ?? (_) {},
              onExportEdges: onExportEdges ?? () async {},
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

TextEditingController _controller(WidgetTester tester, Key key) {
  return tester
      .widget<EditableText>(
        find.descendant(
          of: find.byKey(key),
          matching: find.byType(EditableText),
        ),
      )
      .controller;
}

EdgeEditorState _state({
  bool canSave = false,
  String distance = '',
  String edgeId = '',
  List<RouteGraphEdgeExport> edges = const [],
  Object? exportError,
  EdgeExportStatus exportStatus = EdgeExportStatus.idle,
  List<EdgeFieldDraft> fields = const [],
  List<OverlayRouteNode> routeNodes = const [],
  List<String> selectedNodeIds = const [],
  String serializedDocument = '{\n  "edges": []\n}',
}) {
  return EdgeEditorState(
    canSave: canSave,
    distance: distance,
    draftPairKey: '',
    edgeId: edgeId,
    edgeSegments: const [],
    edges: edges,
    exportError: exportError,
    exportStatus: exportStatus,
    fields: fields,
    isInitialized: true,
    routeNodes: routeNodes,
    selectedNodeIds: selectedNodeIds,
    serializedDocument: serializedDocument,
  );
}

RouteGraphEdgeExport _edge(String id) =>
    RouteGraphEdgeExport(distance: 10, from: 'a', id: id, to: 'b');

OverlayRouteNode _node(int id, String nodeId) => OverlayRouteNode(
  id: id,
  nodeId: nodeId,
  type: 'route',
  screenX: 0,
  screenY: 0,
  tiledX: 0,
  tiledY: 0,
);
