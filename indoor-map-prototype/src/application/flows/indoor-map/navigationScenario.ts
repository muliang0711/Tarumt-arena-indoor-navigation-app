import { colors } from '../../../shared/theme/tokens';
import type {
  DestinationAnchor,
  DestinationFloorCatalog,
  DestinationRoomCategory,
  FloorOption,
  NavigationScenario,
  ParsedMapFloor,
  Point,
  RouteModel,
} from '../../../shared/types';

const FLOOR_OPTIONS: FloorOption[] = [
  { id: 'student-center-level-1', label: '1st Floor', availability: 'preview' },
  { id: 'student-center-level-2', label: '2nd Floor', availability: 'preview' },
  { id: 'student-center-level-3', label: '3rd Floor', availability: 'available' },
  { id: 'student-center-level-4', label: '4th Floor', availability: 'preview' },
  { id: 'student-center-level-5', label: '5th Floor', availability: 'preview' },
  { id: 'student-center-level-6', label: '6th Floor', availability: 'preview' },
  { id: 'student-center-ground', label: 'Ground Floor', availability: 'preview' },
];

const FLOOR_ROOM_BLUEPRINTS: Array<{
  id: string;
  categories: Array<{
    label: string;
    rooms: Array<{ label: string; subtitle: string; accentColor: string }>;
  }>;
}> = [
  {
    id: 'student-center-level-6',
    categories: [
      {
        label: 'Teaching Rooms',
        rooms: [
          { label: 'TA601', subtitle: 'Interactive lecture room', accentColor: colors.accentBlue },
          { label: 'TA602', subtitle: 'Seminar classroom', accentColor: colors.accentAmber },
        ],
      },
      {
        label: 'Studios',
        rooms: [
          { label: 'ST610', subtitle: 'Creative design studio', accentColor: colors.accentGreen },
          { label: 'ST612', subtitle: 'Digital media studio', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
  {
    id: 'student-center-level-5',
    categories: [
      {
        label: 'Labs',
        rooms: [
          { label: 'LB501', subtitle: 'Fabrication lab', accentColor: colors.accentBlue },
          { label: 'LB503', subtitle: 'Navigation systems lab', accentColor: colors.accentGreen },
        ],
      },
      {
        label: 'Support',
        rooms: [
          { label: 'SR520', subtitle: 'Equipment store', accentColor: colors.accentAmber },
          { label: 'SR522', subtitle: 'Faculty collaboration room', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
  {
    id: 'student-center-level-4',
    categories: [
      {
        label: 'Classrooms',
        rooms: [
          { label: 'CR401', subtitle: 'General teaching room', accentColor: colors.accentBlue },
          { label: 'CR403', subtitle: 'Presentation classroom', accentColor: colors.accentAmber },
        ],
      },
      {
        label: 'Facilities',
        rooms: [
          { label: 'FA410', subtitle: 'Pantry & break area', accentColor: colors.accentGreen },
          { label: 'FA412', subtitle: 'Discussion lounge', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
  {
    id: 'student-center-level-3',
    categories: [
      {
        label: 'Studios',
        rooms: [
          { label: 'Studio 3A', subtitle: 'Collaborative classroom', accentColor: colors.accentAmber },
          { label: 'Studio 3B', subtitle: 'Navigation lab', accentColor: colors.accentBlue },
        ],
      },
      {
        label: 'Critique',
        rooms: [
          { label: 'Studio 3C', subtitle: 'Project critique room', accentColor: colors.accentGreen },
          { label: 'TA201', subtitle: 'Tutorial room', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
  {
    id: 'student-center-level-2',
    categories: [
      {
        label: 'Facilities',
        rooms: [
          { label: 'FC201', subtitle: 'Student services room', accentColor: colors.accentBlue },
          { label: 'FC203', subtitle: 'Prayer room', accentColor: colors.accentGreen },
        ],
      },
      {
        label: 'Learning',
        rooms: [
          { label: 'LM210', subtitle: 'Quiet study room', accentColor: colors.accentAmber },
          { label: 'LM212', subtitle: 'Open collaboration bay', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
  {
    id: 'student-center-level-1',
    categories: [
      {
        label: 'Services',
        rooms: [
          { label: 'SV101', subtitle: 'Help desk', accentColor: colors.accentBlue },
          { label: 'SV103', subtitle: 'Printing room', accentColor: colors.accentAmber },
        ],
      },
      {
        label: 'Commons',
        rooms: [
          { label: 'CM110', subtitle: 'Meeting pod', accentColor: colors.accentGreen },
          { label: 'CM112', subtitle: 'Student commons', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
  {
    id: 'student-center-ground',
    categories: [
      {
        label: 'Arrival',
        rooms: [
          { label: 'G001', subtitle: 'Main reception', accentColor: colors.accentBlue },
          { label: 'G003', subtitle: 'Security post', accentColor: colors.accentAmber },
        ],
      },
      {
        label: 'Amenities',
        rooms: [
          { label: 'G010', subtitle: 'Cafe seating', accentColor: colors.accentGreen },
          { label: 'G012', subtitle: 'Information kiosk', accentColor: colors.accentPurple },
        ],
      },
    ],
  },
];

export function distanceBetweenPoints(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function buildBaseRoomAnchors(floor: ParsedMapFloor): DestinationAnchor[] {
  return [...floor.rooms].sort((left, right) => left.x - right.x).map((room, index) => {
    const roomCenter = {
      x: room.x + room.width * 0.5,
      y: room.y + room.height * 0.56,
    };
    const entrance = {
      x: room.x + room.width * 0.5,
      y: room.y + room.height,
    };

    return {
      id: `prototype-room-${index + 1}`,
      label: `Room ${index + 1}`,
      subtitle: 'Indoor destination',
      floorId: floor.id,
      floorLabel: floor.label,
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
      accentColor: colors.accentBlue,
    };
  });
}

function buildDestinationFloors(floor: ParsedMapFloor): DestinationFloorCatalog[] {
  const baseAnchors = buildBaseRoomAnchors(floor);

  return FLOOR_OPTIONS.map((floorOption) => {
    const floorBlueprint =
      FLOOR_ROOM_BLUEPRINTS.find((candidate) => candidate.id === floorOption.id) ??
      FLOOR_ROOM_BLUEPRINTS[0];

    const categories: DestinationRoomCategory[] = floorBlueprint.categories.map((category, categoryIndex) => ({
      id: `${floorOption.id}-category-${categoryIndex + 1}`,
      label: category.label,
      rooms: category.rooms.map((roomBlueprint, roomIndex) => {
        const baseAnchor =
          baseAnchors[(categoryIndex * category.rooms.length + roomIndex) % baseAnchors.length];

        return {
          ...baseAnchor,
          id: `${floorOption.id}-${roomBlueprint.label.toLowerCase()}`,
          label: roomBlueprint.label,
          subtitle: roomBlueprint.subtitle,
          floorId: floorOption.id,
          floorLabel: floorOption.label,
          buildingName: floor.buildingName,
          accentColor: roomBlueprint.accentColor,
          categoryLabel: category.label,
        };
      }),
    }));

    return {
      id: floorOption.id,
      label: floorOption.label,
      buildingName: floor.buildingName,
      availability: floorOption.availability,
      categories,
      roomCount: categories.reduce((sum, category) => sum + category.rooms.length, 0),
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

  const destinationFloors = buildDestinationFloors(floor);

  return {
    buildingName: floor.buildingName,
    activeFloorId: floor.id,
    floors: FLOOR_OPTIONS,
    destinationFloors,
    currentLocationLabel: 'West Entrance Lobby',
    currentPosition,
    detectedFloorLabel: floor.label,
    destinations: destinationFloors.flatMap((destinationFloor) =>
      destinationFloor.categories.flatMap((category) => category.rooms)
    ),
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

export function getRouteDistance(routePoints: Point[]) {
  return routePoints.reduce((sum, point, index) => {
    if (index === 0) {
      return sum;
    }

    return sum + distanceBetweenPoints(routePoints[index - 1], point);
  }, 0);
}

export function getRoutePositionAtDistance(routePoints: Point[], distancePx: number): Point {
  if (routePoints.length === 0) {
    return { x: 0, y: 0 };
  }

  if (routePoints.length === 1 || distancePx <= 0) {
    return routePoints[0];
  }

  const totalDistance = getRouteDistance(routePoints);
  if (distancePx >= totalDistance) {
    return routePoints[routePoints.length - 1];
  }

  let covered = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const segmentLength = distanceBetweenPoints(start, end);

    if (covered + segmentLength >= distancePx) {
      const ratio = (distancePx - covered) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }

    covered += segmentLength;
  }

  return routePoints[routePoints.length - 1];
}

export function getRouteHeadingAtDistance(routePoints: Point[], distancePx: number) {
  if (routePoints.length < 2) {
    return 0;
  }

  const clampedDistance = Math.max(0, distancePx);
  let covered = 0;

  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const segmentLength = distanceBetweenPoints(start, end);

    if (covered + segmentLength >= clampedDistance || index === routePoints.length - 2) {
      return ((Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI + 360) % 360;
    }

    covered += segmentLength;
  }

  return 0;
}
