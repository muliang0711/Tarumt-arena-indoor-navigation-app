import { ReactNode, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { mapAssetRegistry } from './mapAssetRegistry';
import {
  Bounds,
  getVisualBounds,
  NormalizedMapSchema,
  orderVisualLayers,
} from './mapRendererModel';

type ArenaMapViewProps = {
  mapData: NormalizedMapSchema;
  renderOverlay?: (layout: MapRenderLayout) => ReactNode;
};

export type MapRenderLayout = {
  bounds: Bounds;
};

export function ArenaMapView({ mapData, renderOverlay }: ArenaMapViewProps) {
  const scene = useMemo(() => buildScene(mapData), [mapData]);
  const renderLayout = useMemo(() => ({ bounds: scene.bounds }), [scene.bounds]);

  return (
    <View style={[styles.stage, { width: scene.bounds.width, height: scene.bounds.height }]}>
      {scene.layers.map((layer) => {
        const asset = scene.assetManifest.get(layer.assetId);
        const source = mapAssetRegistry[layer.assetId];
        if (!asset || !source) {
          return null;
        }
        return (
          <Image
            key={layer.id}
            source={source}
            resizeMode="stretch"
            style={[
              styles.mapAsset,
              {
                left: layer.x * scene.mapData.tileSize - scene.bounds.x,
                top: layer.y * scene.mapData.tileSize - scene.bounds.y,
                width: asset.widthPixels,
                height: asset.heightPixels,
              },
            ]}
          />
        );
      })}
      {renderOverlay?.(renderLayout)}
    </View>
  );
}

function buildScene(mapData: NormalizedMapSchema): {
  mapData: NormalizedMapSchema;
  bounds: Bounds;
  layers: ReturnType<typeof orderVisualLayers>;
  assetManifest: Map<string, NormalizedMapSchema['assets'][number]>;
} {
  return {
    mapData,
    bounds: getVisualBounds(mapData),
    layers: orderVisualLayers(mapData.visualLayers),
    assetManifest: new Map(mapData.assets.map((asset) => [asset.id, asset])),
  };
}

const styles = StyleSheet.create({
  stage: {
    overflow: 'hidden',
    backgroundColor: '#f5f4ef',
  },
  mapAsset: {
    position: 'absolute',
  },
});
