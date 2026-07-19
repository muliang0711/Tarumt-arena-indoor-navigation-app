import type { TiledImageLayer } from './TiledImageLayer';
import type { TiledObjectLayer } from './TiledObjectLayer';
import type { TiledTileLayer } from './TiledTileLayer';

export type TiledLayer = TiledTileLayer | TiledImageLayer | TiledObjectLayer;
