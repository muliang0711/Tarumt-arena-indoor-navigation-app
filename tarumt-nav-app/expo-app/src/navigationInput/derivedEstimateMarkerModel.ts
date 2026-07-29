import type { DerivedNavigationEstimate } from './type';
import type { RedMarkerState, SurfaceRect } from '../tiled/type';

export function redMarkerFromDerivedEstimate(
  estimate: DerivedNavigationEstimate,
  surface: SurfaceRect,
): RedMarkerState {
  return {
    headingDegrees: estimate.headingDegrees,
    kind: 'redMarker',
    screenX: estimate.x,
    screenY: estimate.y,
    tiledX: estimate.x + surface.originX,
    tiledY: estimate.y + surface.originY,
  };
}
