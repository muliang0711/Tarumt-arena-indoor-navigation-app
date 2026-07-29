import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

RedMarkerState redMarkerFromDerivedEstimate(
  DerivedNavigationEstimate estimate,
  SurfaceRect surface,
) {
  return RedMarkerState(
    headingDegrees: estimate.headingDegrees,
    screenX: estimate.x,
    screenY: estimate.y,
    tiledX: estimate.x + surface.originX,
    tiledY: estimate.y + surface.originY,
  );
}
