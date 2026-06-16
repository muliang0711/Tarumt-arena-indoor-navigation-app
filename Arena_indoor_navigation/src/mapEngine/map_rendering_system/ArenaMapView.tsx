import { ReactNode, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { radius } from '../../components/theme';
import { mapAssetRegistry } from './mapAssetRegistry';
import {
  Bounds,
  getVisualBounds,
  NormalizedMapSchema,
  orderVisualLayers,
} from './mapRendererModel';

type ArenaMapViewProps = {
  mapData: NormalizedMapSchema;
  height?: number;
  renderOverlay?: (layout: MapRenderLayout) => ReactNode;
};

export type MapRenderLayout = {
  bounds: Bounds;
  scale: number;
};

export function ArenaMapView({ mapData, height = 390, renderOverlay }: ArenaMapViewProps) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const scene = useMemo(() => buildScene(mapData), [mapData]);
  const scale = layoutWidth > 0 ? Math.min(layoutWidth / scene.bounds.width, height / scene.bounds.height) : 1;
  const contentWidth = scene.bounds.width * scale;
  const contentHeight = scene.bounds.height * scale;
  const renderLayout = useMemo(() => ({ bounds: scene.bounds, scale }), [scene.bounds, scale]);

  function handleLayout(event: LayoutChangeEvent) {
    setLayoutWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={[styles.viewport, { height }]} onLayout={handleLayout}>
      <View style={[styles.stage, { width: contentWidth, height: contentHeight }]}>
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
                  left: (layer.x * scene.mapData.tileSize - scene.bounds.x) * scale,
                  top: (layer.y * scene.mapData.tileSize - scene.bounds.y) * scale,
                  width: asset.widthPixels * scale,
                  height: asset.heightPixels * scale,
                },
              ]}
            />
          );
        })}
        {renderOverlay?.(renderLayout)}
      </View>
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
  viewport: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#1f2933',
  },
  stage: {
    overflow: 'hidden',
    backgroundColor: '#f5f4ef',
  },
  mapAsset: {
    position: 'absolute',
  },
});
