import { Image, StyleSheet } from 'react-native';

import type { Bounds, MapCoordinateSystem } from '../shared';
import { bobActorAssets } from './actorAssetRegistry';
import { Actor, routeNodeToPixels } from './actorModel';

type ActorLayerLayout = {
  bounds: Bounds;
};

type ActorLayerProps = {
  actors: Actor[];
  layout: ActorLayerLayout;
  coordinateSystem: MapCoordinateSystem;
};

const BOB_SIZE = 32;

export function ActorLayer({ actors, layout, coordinateSystem }: ActorLayerProps) {
  return (
    <>
      {actors.map((actor) => {
        const point = routeNodeToPixels(actor, coordinateSystem);
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
