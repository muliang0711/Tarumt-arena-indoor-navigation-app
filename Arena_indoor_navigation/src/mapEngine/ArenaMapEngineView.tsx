import { useMemo } from 'react';

import { ActorLayer } from './actor_system/ActorLayer';
import { buildBobActorAtNode } from './actor_system/actorModel';
import { ArenaMapView } from './map_rendering_system/ArenaMapView';
import { normalizeMapSchema } from './map_rendering_system/mapRendererModel';

type ArenaMapEngineViewProps = {
  height?: number;
};

const rawMapData = require('../storage/map-assets/map.json');

export function ArenaMapEngineView({ height = 390 }: ArenaMapEngineViewProps) {
  const mapData = useMemo(() => normalizeMapSchema(rawMapData), []);
  const actors = useMemo(() => [buildBobActorAtNode(mapData, 'node_1')], [mapData]);

  return (
    <ArenaMapView
      mapData={mapData}
      height={height}
      renderOverlay={(layout) => (
        <ActorLayer
          actors={actors}
          layout={layout}
          pixelsPerMeter={mapData.movement.coordinateSystem.pixelsPerMeter}
        />
      )}
    />
  );
}
