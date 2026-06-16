import { Image, StyleSheet } from 'react-native';

import { MapRenderLayout } from '../map_rendering_system/ArenaMapView';
import { bobActorAssets } from './actorAssetRegistry';
import { Actor, routeNodeToPixels } from './actorModel';

type ActorLayerProps = {
  actors: Actor[];
  layout: MapRenderLayout;
  pixelsPerMeter: number;
};

const BOB_SIZE = 32;

export function ActorLayer({ actors, layout, pixelsPerMeter }: ActorLayerProps) {
  return (
    <>
      {actors.map((actor) => {
        const point = routeNodeToPixels(actor, pixelsPerMeter);
        return (
          <Image
            key={actor.id}
            source={bobActorAssets.idleDown}
            resizeMode="contain"
            style={[
              styles.actor,
              {
                left: (point.x - layout.bounds.x) * layout.scale - (BOB_SIZE * layout.scale) / 2,
                top: (point.y - layout.bounds.y) * layout.scale - BOB_SIZE * layout.scale,
                width: BOB_SIZE * layout.scale,
                height: BOB_SIZE * layout.scale,
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  actor: {
    position: 'absolute',
    zIndex: 20,
  },
});
