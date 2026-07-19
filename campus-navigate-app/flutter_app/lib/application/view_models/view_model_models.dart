enum IndoorNavigationMode { edges, navigate }

enum IndoorNavigationLoadStatus { idle, loading, ready, error }

enum IndoorNavigationLifecycleStatus { active, paused, disposed }

enum NavigationSessionStatus { navigating, arrived, completed }

const indoorNavigationZoomSteps = <double>[0.5, 0.75, 1, 1.25, 1.5, 2];
const indoorNavigationDefaultZoomIndex = 2;

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
