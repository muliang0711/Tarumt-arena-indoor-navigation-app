import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';

import { ActorLayer, buildBobActorAtNode } from './actor_system/actorSystem';
import {
  CameraState,
  CameraViewport,
  createInitialCameraState,
  panCamera,
} from './cameran_system/cameranSystem';
import { ArenaMapView, getVisualBounds, normalizeMapSchema } from './map_rendering_system/mapRenderingSystem';

type ArenaMapEngineViewProps = {
  mapData?: unknown;
  height?: number;
};

const defaultMapData = require('../storage/map-assets/map.json');

export function ArenaMapEngineView({ mapData: rawMapData = defaultMapData, height = 390 }: ArenaMapEngineViewProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [camera, setCamera] = useState<CameraState | null>(null);
  const mapData = useMemo(() => normalizeMapSchema(rawMapData), [rawMapData]);
  const actors = useMemo(() => [buildBobActorAtNode(mapData, 'node_1')], [mapData]);
  const bounds = useMemo(() => getVisualBounds(mapData), [mapData]);
  const viewportSize = useMemo(() => ({ width: Math.max(1, viewportWidth), height }), [height, viewportWidth]);
  const initialCamera = useMemo(() => createInitialCameraState(bounds, viewportSize), [bounds, viewportSize]);

  useEffect(() => {
    if (viewportWidth > 0) {
      setCamera(createInitialCameraState(bounds, viewportSize));
    }
  }, [bounds, viewportSize, viewportWidth]);

  const renderedCamera = camera ?? initialCamera;

  function handlePanBy(delta: { x: number; y: number }) {
    setCamera((currentCamera) => panCamera(currentCamera ?? initialCamera, delta));
  }

  function handleLayout(event: LayoutChangeEvent) {
    setViewportWidth(event.nativeEvent.layout.width);
  }

  return (
    <CameraViewport
      camera={renderedCamera}
      contentWidth={bounds.width}
      contentHeight={bounds.height}
      height={height}
      onLayout={handleLayout}
      onPanBy={handlePanBy}
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
