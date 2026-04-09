import { Image } from 'react-native';

import mapPackageJson from '../../assets/maps/village_demo_01/map.json';
import type { MapPackageJson, SpriteAssetDefinition } from '../types';

function createAsset(
  assetId: string,
  source: number,
  widthPx: number,
  heightPx: number,
  category: SpriteAssetDefinition['category'],
): SpriteAssetDefinition {
  return {
    assetId,
    source,
    uri: Image.resolveAssetSource(source).uri,
    widthPx,
    heightPx,
    category,
  };
}

export const MAP_PACKAGE_JSON = mapPackageJson as MapPackageJson;

export const MAP_ASSET_REGISTRY: Record<string, SpriteAssetDefinition> = {
  serious_shit__classroom_1: createAsset(
    'serious_shit__classroom_1',
    require('../../assets/maps/village_demo_01/resources/serious_shit/classroom_1.png'),
    192,
    128,
    'room',
  ),
  serious_shit__examroom_1: createAsset(
    'serious_shit__examroom_1',
    require('../../assets/maps/village_demo_01/resources/serious_shit/examroom_1.png'),
    192,
    128,
    'room',
  ),
  serious_shit__meetingroom_1: createAsset(
    'serious_shit__meetingroom_1',
    require('../../assets/maps/village_demo_01/resources/serious_shit/meetingroom_1.png'),
    192,
    128,
    'room',
  ),
  serious_shit__elevator: createAsset(
    'serious_shit__elevator',
    require('../../assets/maps/village_demo_01/resources/serious_shit/elevator.png'),
    128,
    128,
    'utility',
  ),
  serious_shit__staris: createAsset(
    'serious_shit__staris',
    require('../../assets/maps/village_demo_01/resources/serious_shit/staris.png'),
    128,
    128,
    'utility',
  ),
  serious_shit__toilet: createAsset(
    'serious_shit__toilet',
    require('../../assets/maps/village_demo_01/resources/serious_shit/toilet.png'),
    128,
    128,
    'utility',
  ),
  serious_shit__walkable_road_clean: createAsset(
    'serious_shit__walkable_road_clean',
    require('../../assets/maps/village_demo_01/resources/serious_shit/walkable_road_clean.png'),
    16,
    16,
    'road',
  ),
  serious_shit__walkable_road_dirt: createAsset(
    'serious_shit__walkable_road_dirt',
    require('../../assets/maps/village_demo_01/resources/serious_shit/walkable_road_dirt.png'),
    16,
    16,
    'road',
  ),
  serious_shit__unwalkable_tile_clean: createAsset(
    'serious_shit__unwalkable_tile_clean',
    require('../../assets/maps/village_demo_01/resources/serious_shit/unwalkable_tile_clean.png'),
    16,
    16,
    'surface',
  ),
  serious_shit__unwalkable_tile_dirt: createAsset(
    'serious_shit__unwalkable_tile_dirt',
    require('../../assets/maps/village_demo_01/resources/serious_shit/unwalkable_tile_dirt.png'),
    16,
    16,
    'surface',
  ),
  serious_shit__white_greg_tile: createAsset(
    'serious_shit__white_greg_tile',
    require('../../assets/maps/village_demo_01/resources/serious_shit/white_greg_tile.png'),
    16,
    16,
    'surface',
  ),
  serious_shit__white_tile: createAsset(
    'serious_shit__white_tile',
    require('../../assets/maps/village_demo_01/resources/serious_shit/white_tile.png'),
    16,
    16,
    'surface',
  ),
};
