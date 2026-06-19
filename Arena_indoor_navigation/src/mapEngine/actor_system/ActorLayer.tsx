import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import type { Bounds, MapCoordinateSystem } from '../shared';
import { bobIdleAssets, bobRunAssets } from './actorAssetRegistry';
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
const RUN_FRAME_MS = 110;

export function ActorLayer({ actors, layout, coordinateSystem }: ActorLayerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const runningActor = actors.find((actor) => actor.action === 'run') ?? null;

  useEffect(() => {
    if (!runningActor) {
      setFrameIndex(0);
      return;
    }

    const frameCount = bobRunAssets[runningActor.direction].length;
    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frameCount);
    }, RUN_FRAME_MS);

    return () => clearInterval(timer);
  }, [runningActor]);

  return (
    <>
      {actors.map((actor) => {
        const point = routeNodeToPixels(actor, coordinateSystem);
        const source =
          actor.action === 'run'
            ? bobRunAssets[actor.direction][frameIndex % bobRunAssets[actor.direction].length]
            : bobIdleAssets[actor.direction];

        return (
          <Image
            key={actor.id}
            source={source}
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
