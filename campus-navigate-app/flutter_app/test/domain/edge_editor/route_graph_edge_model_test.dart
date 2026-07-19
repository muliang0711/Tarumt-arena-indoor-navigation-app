import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_graph_edge_model.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  test('creates an export edge with required and custom fields', () {
    final edge = createRouteGraphEdge(
      CreateRouteGraphEdgeInput(
        distance: 12.345,
        fields: const <EdgeFieldDraft>[
          EdgeFieldDraft(key: 'floor', value: '2'),
          EdgeFieldDraft(key: 'accessible', value: 'true'),
          EdgeFieldDraft(key: 'distance', value: '999'),
          EdgeFieldDraft(key: ' from ', value: 'ignored'),
          EdgeFieldDraft(key: '', value: 'ignored'),
        ],
        from: 'node-1',
        id: ' edge-1 ',
        to: 'node-2',
      ),
    );

    expect(edge.distance, 12.35);
    expect(edge.from, 'node-1');
    expect(edge.id, 'edge-1');
    expect(edge.to, 'node-2');
    expect(edge.customFields, <String, Object>{'floor': 2, 'accessible': true});
  });

  test('uses trimmed custom keys, original string values, and last value', () {
    final edge = createRouteGraphEdge(
      CreateRouteGraphEdgeInput(
        distance: 1,
        fields: const <EdgeFieldDraft>[
          EdgeFieldDraft(key: ' label ', value: '  TA257  '),
          EdgeFieldDraft(key: 'label', value: 'final'),
        ],
        from: ' from ',
        id: ' id ',
        to: ' to ',
      ),
    );

    expect(edge.from, ' from ');
    expect(edge.id, 'id');
    expect(edge.to, ' to ');
    expect(edge.customFields, <String, Object>{'label': 'final'});
  });

  test('parses useful JSON scalar values with JavaScript Number behavior', () {
    expect(parseEdgeFieldValue('42'), 42);
    expect(parseEdgeFieldValue(' 1.5 '), 1.5);
    expect(parseEdgeFieldValue('1e2'), 100);
    expect(parseEdgeFieldValue('0x10'), 16);
    expect(parseEdgeFieldValue('0b11'), 3);
    expect(parseEdgeFieldValue('0o10'), 8);
    expect((parseEdgeFieldValue('-0') as num).isNegative, isTrue);
    expect(parseEdgeFieldValue('true'), isTrue);
    expect(parseEdgeFieldValue('false'), isFalse);
    expect(parseEdgeFieldValue('TRUE'), 'TRUE');
    expect(parseEdgeFieldValue('Infinity'), 'Infinity');
    expect(parseEdgeFieldValue('NaN'), 'NaN');
    expect(parseEdgeFieldValue('TA257'), 'TA257');
    expect(parseEdgeFieldValue(''), '');
    expect(parseEdgeFieldValue('   '), '   ');
  });

  test('preserves JavaScript negative-zero rounding in the domain model', () {
    final edge = createRouteGraphEdge(
      CreateRouteGraphEdgeInput(
        distance: -0.001,
        fields: const <EdgeFieldDraft>[],
        from: 'a',
        id: 'e',
        to: 'b',
      ),
    );

    expect(edge.distance, 0);
    expect(edge.distance.isNegative, isTrue);
    expect(
      stringifyRouteGraphEdgeDocument(<RouteGraphEdgeExport>[edge], 'map'),
      contains('"distance": 0'),
    );
  });

  test('serializes a stable edge document with trailing newline', () {
    final serialized = stringifyRouteGraphEdgeDocument(<RouteGraphEdgeExport>[
      RouteGraphEdgeExport(
        distance: 10,
        from: 'node-1',
        id: 'edge-1',
        to: 'node-2',
      ),
    ], 'demo_1.tmj');

    expect(
      serialized,
      '{\n'
      '  "edges": [\n'
      '    {\n'
      '      "distance": 10,\n'
      '      "from": "node-1",\n'
      '      "id": "edge-1",\n'
      '      "to": "node-2"\n'
      '    }\n'
      '  ],\n'
      '  "kind": "route-graph-edges",\n'
      '  "sourceMap": "demo_1.tmj",\n'
      '  "version": 1\n'
      '}\n',
    );
  });

  test('serializes custom fields after required fields in insertion order', () {
    final serialized = stringifyRouteGraphEdgeDocument(<RouteGraphEdgeExport>[
      RouteGraphEdgeExport(
        distance: 1.5,
        from: 'a',
        id: 'e',
        to: 'b',
        customFields: <String, Object>{
          'floor': 2.0,
          'accessible': false,
          'label': 'A',
        },
      ),
    ], 'map.tmj');

    expect(serialized.indexOf('"to"'), lessThan(serialized.indexOf('"floor"')));
    expect(
      serialized.indexOf('"floor"'),
      lessThan(serialized.indexOf('"accessible"')),
    );
    expect(serialized, contains('"floor": 2'));
    expect(serialized, isNot(contains('"floor": 2.0')));
    expect(serialized.endsWith('\n'), isTrue);
  });

  test('matches JavaScript object enumeration for array-index keys', () {
    final edge = createRouteGraphEdge(
      CreateRouteGraphEdgeInput(
        distance: 1,
        fields: const <EdgeFieldDraft>[
          EdgeFieldDraft(key: '10', value: '10'),
          EdgeFieldDraft(key: '2', value: '2'),
          EdgeFieldDraft(key: '1', value: '1'),
          EdgeFieldDraft(key: '__proto__', value: 'ignored'),
          EdgeFieldDraft(key: '01', value: 'one'),
        ],
        from: 'a',
        id: 'e',
        to: 'b',
      ),
    );
    final serialized = stringifyRouteGraphEdgeDocument(<RouteGraphEdgeExport>[
      edge,
    ], 'map');

    expect(edge.customFields, isNot(contains('__proto__')));
    expect(serialized.indexOf('"1"'), lessThan(serialized.indexOf('"2"')));
    expect(serialized.indexOf('"2"'), lessThan(serialized.indexOf('"10"')));
    expect(
      serialized.indexOf('"10"'),
      lessThan(serialized.indexOf('"distance"')),
    );
    expect(serialized.indexOf('"to"'), lessThan(serialized.indexOf('"01"')));
    expect(serialized, isNot(contains('__proto__')));
  });

  test(
    'matches JavaScript JSON number formatting at the exponent boundary',
    () {
      final edge = createRouteGraphEdge(
        CreateRouteGraphEdgeInput(
          distance: 1,
          fields: const <EdgeFieldDraft>[
            EdgeFieldDraft(key: 'big', value: '1e21'),
            EdgeFieldDraft(key: 'near', value: '1000000000000000100'),
          ],
          from: 'a',
          id: 'e',
          to: 'b',
        ),
      );

      expect(
        stringifyRouteGraphEdgeDocument(<RouteGraphEdgeExport>[edge], 'map'),
        contains('"big": 1e+21,\n      "near": 1000000000000000100'),
      );
    },
  );

  test('parses the original EDGE document without copying it', () {
    final edgeFile = File.fromUri(
      Directory.current.parent.uri.resolve(
        'expo-app/assets/maps/demo_1.edges.json',
      ),
    );
    final document = parseRouteGraphEdgeDocumentJson(
      edgeFile.readAsStringSync(),
    );

    expect(document.sourceMap, 'demo_1.tmj');
    expect(document.edges, hasLength(24));
    expect(document.edges.first.distance, 2);
    expect(document.edges.first.from, 'node-1');
    expect(document.edges.first.id, 'edge-node-1-node-21');
    expect(document.edges.first.to, 'node-21');
  });

  test('rejects unsupported EDGE contracts and non-scalar custom fields', () {
    expect(
      () => parseRouteGraphEdgeDocumentJson(
        '{"edges":[],"kind":"other","sourceMap":"x","version":1}',
      ),
      throwsA(
        isA<UnsupportedError>().having(
          (error) => error.message,
          'message',
          'Unsupported EDGE document kind: other',
        ),
      ),
    );
    expect(
      () => parseRouteGraphEdgeDocumentJson(
        '{"edges":[],"kind":"route-graph-edges",'
        '"sourceMap":"x","version":2}',
      ),
      throwsA(
        isA<UnsupportedError>().having(
          (error) => error.message,
          'message',
          'Unsupported EDGE document version: 2',
        ),
      ),
    );
    expect(
      () => parseRouteGraphEdgeDocumentJson(
        '{"edges":[{"distance":1,"from":"a","id":"e","to":"b",'
        '"metadata":{}}],"kind":"route-graph-edges",'
        '"sourceMap":"x","version":1}',
      ),
      throwsA(isA<FormatException>()),
    );
  });

  test('creates path segments and skips edges with missing nodes', () {
    const from = OverlayRouteNode(
      screenX: 0,
      screenY: 0,
      tiledX: 10,
      tiledY: 10,
      id: 1,
      nodeId: 'a',
      type: 'route-node',
    );
    const to = OverlayRouteNode(
      screenX: 3,
      screenY: 4,
      tiledX: 13,
      tiledY: 14,
      id: 2,
      nodeId: 'b',
      type: 'route-node',
    );
    final edges = <RouteGraphEdgeExport>[
      RouteGraphEdgeExport(distance: 5, from: 'a', id: 'edge-ab', to: 'b'),
      RouteGraphEdgeExport(
        distance: 1,
        from: 'missing',
        id: 'missing',
        to: 'b',
      ),
    ];
    final segments = createEdgePathSegments(edges, const <OverlayRouteNode>[
      from,
      to,
    ]);

    expect(segments, hasLength(1));
    expect(segments.single.fromNodeId, 'a');
    expect(segments.single.key, 'edge-ab');
    expect(segments.single.length, 5);
    expect(segments.single.rotationDegrees, closeTo(53.1301, 0.0001));
    expect(segments.single.toNodeId, 'b');
    expect(segments.single.x, 0);
    expect(segments.single.y, 0);
    expect(createNodeDistance(from, to), 5);
  });
}
