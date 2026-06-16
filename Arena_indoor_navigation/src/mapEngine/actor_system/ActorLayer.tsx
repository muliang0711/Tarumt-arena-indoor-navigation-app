import { Image, StyleSheet } from 'react-native';

import { Bounds } from '../mapGeometry';
import { bobActorAssets } from './actorAssetRegistry';
import { Actor, routeNodeToPixels } from './actorModel';

type ActorLayerLayout = {
  bounds: Bounds;
};

type ActorLayerProps = {
  actors: Actor[];
  layout: ActorLayerLayout;
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
                left: point.x - layout.bounds.x - BOB_SIZE / 2,
                top: point.y - layout.bounds.y - BOB_SIZE,
                width: BOB_SIZE,
                height: BOB_SIZE,
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
