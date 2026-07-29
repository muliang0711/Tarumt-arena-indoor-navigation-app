enum IndoorNavigationMode { edges, navigate }

enum IndoorNavigationLoadStatus { idle, loading, ready, error }

enum IndoorNavigationLifecycleStatus { active, paused, disposed }

enum NavigationSessionStatus { navigating, arrived, completed }

const indoorNavigationZoomSteps = <double>[0.5, 0.75, 1, 1.25, 1.5, 2];
const indoorNavigationDefaultZoomIndex = 2;
const indoorNavigationMinZoom = 0.5;
const indoorNavigationMaxZoom = 2.0;

double indoorNavigationZoomAt(int index) {
  if (index < 0 || index >= indoorNavigationZoomSteps.length) {
    throw RangeError.range(
      index,
      0,
      indoorNavigationZoomSteps.length - 1,
      'index',
    );
  }
  return indoorNavigationZoomSteps[index];
}

double clampIndoorNavigationZoom(double zoom) =>
    zoom.clamp(indoorNavigationMinZoom, indoorNavigationMaxZoom).toDouble();

double nextIndoorNavigationZoomIn(double zoom) {
  final current = clampIndoorNavigationZoom(zoom);
  return indoorNavigationZoomSteps.firstWhere(
    (step) => step > current,
    orElse: () => indoorNavigationMaxZoom,
  );
}

double nextIndoorNavigationZoomOut(double zoom) {
  final current = clampIndoorNavigationZoom(zoom);
  return indoorNavigationZoomSteps.lastWhere(
    (step) => step < current,
    orElse: () => indoorNavigationMinZoom,
  );
}

/// Converts clockwise compass heading (north = 0°) into the fixed floor-plan
/// coordinates. The bundled map is south-up, so north points down at 90°.
double mapHeadingFromDeviceHeadingDegrees(double deviceHeadingDegrees) {
  final heading = (deviceHeadingDegrees + 90).remainder(360);
  return heading < 0 ? heading + 360 : heading;
}
