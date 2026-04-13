import { parseIndoorMapPackage } from './mapParser';
import { MAP_ASSET_REGISTRY, MAP_PACKAGE_JSON } from './mapReference';
import type { ParsedMapFloor } from '../../shared/types';

let cachedFloor: ParsedMapFloor | null = null;

export function getPrototypeFloor(): ParsedMapFloor {
  if (!cachedFloor) {
    cachedFloor = parseIndoorMapPackage(MAP_PACKAGE_JSON, MAP_ASSET_REGISTRY);
  }

  return cachedFloor;
}
