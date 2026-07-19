import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_parser.dart';

void main() {
  late String edgesJson;
  late String nodesJson;
  late String roomsJson;

  setUpAll(() {
    edgesJson = File('assets/maps/demo_1.edges.json').readAsStringSync();
    nodesJson = File('assets/maps/demo_1.nodes.json').readAsStringSync();
    roomsJson = File('assets/campus/main_campus.rooms.json').readAsStringSync();
  });

  test('joins all Floor 2 nodes and editable rooms with reachability', () {
    final catalog = parseCampusCatalogBundle(
      edgeDocumentJson: edgesJson,
      nodeCatalogJson: nodesJson,
      roomCatalogJson: roomsJson,
    );

    expect(catalog.schemaVersion, 1);
    expect(catalog.buildingName, 'Main Campus Building');
    expect(catalog.defaultFloorId, 'floor-2');
    expect(catalog.startNodeId, 'node-21');
    expect(catalog.floors, hasLength(1));
    expect(catalog.nodes, hasLength(22));
    expect(catalog.rooms, hasLength(14));

    final ta257 = catalog.rooms.firstWhere((room) => room.id == 'TA257');
    expect(ta257.navigationNodeId, 'node-20');
    expect(ta257.navigationAvailable, isTrue);

    final toilet1 = catalog.rooms.firstWhere((room) => room.id == 'toilet-1');
    expect(toilet1.navigationNodeId, 'node-22');
    expect(toilet1.navigationAvailable, isFalse);
    expect(toilet1.navigationIssue, contains('not connected'));

    final floorRoomsState = createFloorRoomsViewState(catalog);
    expect(floorRoomsState.selectedFloorId, 'floor-2');
    expect(floorRoomsState.visibleRooms, hasLength(14));
    final home = HomeViewModel.fromCatalog(catalog);
    expect(home.state.popularPlaces.map((place) => place.name), [
      'Elevator',
      'TA242',
      'TA241',
      'TA240',
    ]);
  });

  test('rejects a room whose node mapping does not match', () {
    final rooms = jsonDecode(roomsJson) as Map<String, Object?>;
    final entries = rooms['rooms']! as List<Object?>;
    final first = entries.first! as Map<String, Object?>;
    first['nodeId'] = 'node-2';

    expect(
      () => parseCampusCatalogBundle(
        edgeDocumentJson: edgesJson,
        nodeCatalogJson: nodesJson,
        roomCatalogJson: jsonEncode(rooms),
      ),
      throwsA(isA<FormatException>()),
    );
  });

  test('rejects roomIds extracted from the map but missing in catalog', () {
    final rooms = jsonDecode(roomsJson) as Map<String, Object?>;
    final entries = rooms['rooms']! as List<Object?>;
    entries.removeWhere(
      (entry) => (entry! as Map<String, Object?>)['id'] == 'TA257',
    );

    expect(
      () => parseCampusCatalogBundle(
        edgeDocumentJson: edgesJson,
        nodeCatalogJson: nodesJson,
        roomCatalogJson: jsonEncode(rooms),
      ),
      throwsA(
        isA<FormatException>().having(
          (error) => error.message,
          'message',
          contains('TA257'),
        ),
      ),
    );
  });
}
