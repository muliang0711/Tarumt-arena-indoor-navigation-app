import type { TiledChunk } from './TiledChunk';

export type TiledTileLayer = {
  chunks?: TiledChunk[];
  data?: number[];
  height?: number;
  id: number;
  name: string;
  opacity?: number;
  startx?: number;
  starty?: number;
  type: 'tilelayer';
  visible?: boolean;
  width?: number;
  x?: number;
  y?: number;
};
