import { createMovementConstraintProvider } from '../movement_system';
import type {
  LineSegment,
  MovementConstraintMapInput,
  Polygon,
} from '../shared';

export type WorldRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UnwalkableOverlayModel = {
  walkableAreas: readonly Polygon[];
  blockedAreas: readonly Polygon[];
  walls: readonly LineSegment[];
  unwalkableCells: readonly WorldRectangle[];
  mergedRectangles: readonly WorldRectangle[];
};

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function mergeHorizontalCells(
  cells: readonly WorldRectangle[],
  cellSize: number,
): WorldRectangle[] {
  const rows = new Map<number, WorldRectangle[]>();
  for (const cell of cells) {
    rows.set(cell.y, [...(rows.get(cell.y) ?? []), cell]);
  }

  return [...rows.values()].flatMap((row) => {
    const ordered = [...row].sort((left, right) => left.x - right.x);
    const merged: WorldRectangle[] = [];
    for (const cell of ordered) {
      const previous = merged.at(-1);
      if (
        previous &&
        Math.abs(previous.x + previous.width - cell.x) < 0.000001
      ) {
        previous.width = rounded(previous.width + cellSize);
      } else {
        merged.push({ ...cell });
      }
    }
    return merged;
  });
}

export function buildUnwalkableOverlayModel(
  constraintInput: MovementConstraintMapInput,
  worldBounds: WorldRectangle,
): UnwalkableOverlayModel {
  const provider = createMovementConstraintProvider(constraintInput);
  const cellSize = constraintInput.coordinateSystem.metersPerTile;
  const columns = Math.ceil(worldBounds.width / cellSize);
  const rows = Math.ceil(worldBounds.height / cellSize);
  const unwalkableCells: WorldRectangle[] = [];

  if (constraintInput.walkableAreas.length > 0) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = rounded(worldBounds.x + column * cellSize);
        const y = rounded(worldBounds.y + row * cellSize);
        const width = rounded(
          Math.min(cellSize, worldBounds.x + worldBounds.width - x),
        );
        const height = rounded(
          Math.min(cellSize, worldBounds.y + worldBounds.height - y),
        );
        if (
          width > 0 &&
          height > 0 &&
          !provider.isWalkable({
            x: x + width / 2,
            y: y + height / 2,
          })
        ) {
          unwalkableCells.push({ x, y, width, height });
        }
      }
    }
  }

  return {
    walkableAreas: constraintInput.walkableAreas,
    blockedAreas: constraintInput.blockedAreas ?? [],
    walls: constraintInput.walls,
    unwalkableCells,
    mergedRectangles: mergeHorizontalCells(unwalkableCells, cellSize),
  };
}
