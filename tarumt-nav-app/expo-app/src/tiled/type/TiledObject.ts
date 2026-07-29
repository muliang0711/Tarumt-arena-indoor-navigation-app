import type { TiledProperty } from './TiledProperty';

export type TiledObject = {
  height?: number;
  id: number;
  name: string;
  point?: boolean;
  properties?: TiledProperty[];
  text?: {
    text?: string;
    wrap?: boolean;
  };
  type?: string;
  width?: number;
  x: number;
  y: number;
};
