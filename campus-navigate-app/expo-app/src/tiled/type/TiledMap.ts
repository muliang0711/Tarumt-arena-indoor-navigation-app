import type { TiledLayer } from './TiledLayer';
import type { TiledTileset } from './TiledTileset';

export type TiledMap = {
  height: number;
  infinite?: boolean;
  layers: TiledLayer[];
  orientation: string;
  renderorder?: string;
  tileheight: number;
  tilesets: TiledTileset[];
  tilewidth: number;
  type: 'map';
  version: string;
  width: number;
};
