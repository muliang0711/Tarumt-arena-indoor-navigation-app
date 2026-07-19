import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/ports/assets/campus_catalog_repository.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_models.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_parser.dart';

const defaultCampusRoomCatalogAssetPath =
    'assets/campus/main_campus.rooms.json';
const defaultCampusNodeCatalogAssetPath = 'assets/maps/demo_1.nodes.json';
const defaultCampusEdgeCatalogAssetPath = 'assets/maps/demo_1.edges.json';

final class FlutterCampusCatalogRepository implements CampusCatalogRepository {
  const FlutterCampusCatalogRepository({this.assetBundle});

  final AssetBundle? assetBundle;

  @override
  Future<CampusCatalog> loadCampusCatalog() async {
    final bundle = assetBundle ?? rootBundle;
    final roomCatalogJson = await bundle.loadString(
      defaultCampusRoomCatalogAssetPath,
    );
    final nodeCatalogJson = await bundle.loadString(
      defaultCampusNodeCatalogAssetPath,
    );
    final edgeDocumentJson = await bundle.loadString(
      defaultCampusEdgeCatalogAssetPath,
    );
    return parseCampusCatalogBundle(
      edgeDocumentJson: edgeDocumentJson,
      nodeCatalogJson: nodeCatalogJson,
      roomCatalogJson: roomCatalogJson,
    );
  }
}
