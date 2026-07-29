import 'package:indoor_navigation/domain/campus/campus_catalog_models.dart';

abstract interface class CampusCatalogRepository {
  Future<CampusCatalog> loadCampusCatalog();
}
