import { colors } from '../../../shared/theme/tokens';
import type {
  DestinationAnchor,
  FloorOption,
  NavigationScenario,
  ParsedMapFloor,
  Point,
  RouteModel,
} from '../../../shared/types';

const DESTINATION_BLUEPRINTS = [
  { label: 'Studio 3A', subtitle: 'Collaborative classroom', accentColor: colors.accentAmber },
  { label: 'Studio 3B', subtitle: 'Navigation lab', accentColor: colors.accentBlue },
  { label: 'Studio 3C', subtitle: 'Project critique room', accentColor: colors.accentGreen },
];

const FLOOR_OPTIONS: FloorOption[] = [
  { id: 'student-center-level-5', label: 'L5', availability: 'preview' },
  { id: 'student-center-level-4', label: 'L4', availability: 'preview' },
  { id: 'student-center-level-3', label: 'L3', availability: 'available' },
  { id: 'student-center-level-2', label: 'L2', availability: 'preview' },
];

function distanceBetweenPoints(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function buildRoomAnchors(floor: ParsedMapFloor): DestinationAnchor[] {
  return [...floor.rooms]
    .sort((left, right) => left.x - right.x)
    .map((room, index) => {
      const blueprint = DESTINATION_BLUEPRINTS[index] ?? {
        label: `Studio ${index + 1}`,
        subtitle: 'Indoor destination',
        accentColor: colors.accentBlue,
      };
      const roomCenter = {
        x: room.x + room.width * 0.5,
        y: room.y + room.height * 0.56,
      };
      const entrance = {
        x: room.x + room.width * 0.5,
        y: room.y + room.height,
      };

      return {
        id: `destination-${index + 1}`,
        label: blueprint.label,
        subtitle: blueprint.subtitle,
        floorId: floor.id,
        buildingName: floor.buildingName,
        roomPlacementId: room.id,
        roomBounds: {
          x: room.x,
          y: room.y,
          width: room.width,
          height: room.height,
        },
        roomCenter,
        entrance,
        accentColor: blueprint.accentColor,
      };
    });
}

function dedupeRoutePoints(points: Point[]) {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = points[index - 1];
    return distanceBetweenPoints(previous, point) > 1;
  });
}

export function buildPrototypeScenario(floor: ParsedMapFloor): NavigationScenario {
  const roadTiles = [...floor.roads].sort((left, right) => left.x - right.x);
  const corridorAnchor = roadTiles[1] ?? roadTiles[0];
  const currentPosition = corridorAnchor
    ? {
        x: corridorAnchor.x + floor.tileSize * 0.5,
        y: corridorAnchor.y + floor.tileSize * 0.5,
      }
    : {
        x: floor.focusBounds.x + floor.focusBounds.width * 0.2,
        y: floor.focusBounds.y + floor.focusBounds.height * 0.75,
      };

  return {
    buildingName: floor.buildingName,
    activeFloorId: floor.id,
    floors: FLOOR_OPTIONS,
    currentLocationLabel: 'West Entrance Lobby',
    currentPosition,
    detectedFloorLabel: floor.label,
    destinations: buildRoomAnchors(floor),
  };
}

export function buildRouteToDestination(
  currentPosition: Point,
  destination: DestinationAnchor,
  tileSize: number,
): RouteModel {
  const corridorY = destination.entrance.y + tileSize * 0.5;
  const routePoints = dedupeRoutePoints([
    currentPosition,
    { x: currentPosition.x, y: corridorY },
    { x: destination.entrance.x, y: corridorY },
    destination.entrance,
    {
      x: destination.roomCenter.x,
      y: destination.roomCenter.y + tileSize * 0.8,
    },
    destination.roomCenter,
  ]);

  const totalDistancePx = routePoints.reduce((sum, point, index) => {
    if (index === 0) {
      return sum;
    }

    return sum + distanceBetweenPoints(routePoints[index - 1], point);
  }, 0);

  const metersPerTile = 1.4;
  const distanceMeters = Math.round((totalDistancePx / tileSize) * metersPerTile);
  const etaMinutes = Math.max(1, Math.ceil(distanceMeters / 28));
  const instruction =
    destination.roomCenter.x >= currentPosition.x
      ? 'Follow the Level 3 spine corridor, then enter the highlighted studio.'
      : 'Move west along the corridor and turn into the highlighted studio.';

  return {
    id: `route-${destination.id}`,
    destinationId: destination.id,
    points: routePoints,
    distanceMeters,
    etaMinutes,
    instruction,
  };
}

export function interpolateRoutePosition(routePoints: Point[], progress: number): Point {
  if (routePoints.length === 0) {
    return { x: 0, y: 0 };
  }

  if (routePoints.length === 1 || progress <= 0) {
    return routePoints[0];
  }

  if (progress >= 1) {
    return routePoints[routePoints.length - 1];
  }

  const segmentLengths = routePoints.slice(1).map((point, index) => {
    return distanceBetweenPoints(routePoints[index], point);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const targetDistance = totalLength * progress;

  let covered = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (covered + segmentLength >= targetDistance) {
      const ratio = (targetDistance - covered) / segmentLength;
      const start = routePoints[index];
      const end = routePoints[index + 1];
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }

    covered += segmentLength;
  }

  return routePoints[routePoints.length - 1];
}
