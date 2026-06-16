import { useMemo, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';

import { ActorLayer, buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorSystem';
import { CameraViewport, centerCameraOnPoint, fitCameraToBounds } from './cameran_system/cameranSystem';
import { ArenaMapView, getVisualBounds, normalizeMapSchema } from './map_rendering_system/mapRenderingSystem';

type ArenaMapEngineViewProps = {
  height?: number;
};

const rawMapData = require('../storage/map-assets/map.json');

export function ArenaMapEngineView({ height = 390 }: ArenaMapEngineViewProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const mapData = useMemo(() => normalizeMapSchema(rawMapData), []);
  const actors = useMemo(() => [buildBobActorAtNode(mapData, 'node_1')], [mapData]);
  const bounds = useMemo(() => getVisualBounds(mapData), [mapData]);
  const camera = useMemo(() => {
    const viewport = { width: Math.max(1, viewportWidth), height };
    const fitted = fitCameraToBounds(bounds, viewport);
    const bobPoint = routeNodeToPixels(actors[0], mapData.movement.coordinateSystem.pixelsPerMeter);
    return centerCameraOnPoint(fitted, bobPoint, viewport);
  }, [actors, bounds, height, mapData.movement.coordinateSystem.pixelsPerMeter, viewportWidth]);

  function handleLayout(event: LayoutChangeEvent) {
    setViewportWidth(event.nativeEvent.layout.width);
  }

  return (
    <CameraViewport
      camera={camera}
      contentWidth={bounds.width}
      contentHeight={bounds.height}
      height={height}
      onLayout={handleLayout}
    >
      <ArenaMapView
        mapData={mapData}
        renderOverlay={(layout) => (
          <ActorLayer
            actors={actors}
            layout={layout}
            pixelsPerMeter={mapData.movement.coordinateSystem.pixelsPerMeter}
          />
        )}
      />
    </CameraViewport>
  );
}
