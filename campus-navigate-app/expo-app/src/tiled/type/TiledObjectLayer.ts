import type { TiledObject } from './TiledObject';

export type TiledObjectLayer = {
  id: number;
  name: string;
  objects?: TiledObject[];
  opacity?: number;
  type: 'objectgroup';
  visible?: boolean;
  x?: number;
  y?: number;
};
