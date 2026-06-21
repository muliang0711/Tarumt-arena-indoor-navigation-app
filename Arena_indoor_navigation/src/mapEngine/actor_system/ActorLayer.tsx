import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
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
const USER_RING_SIZE = 50;
const HEADING_CONE_WIDTH = 64;
const HEADING_CONE_HEIGHT = 50;

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
          <View key={actor.id} pointerEvents="none">
            {actor.isUser ? (
              <>
                <View
                  style={[
                    styles.ring,
                    {
                      left: point.x - layout.bounds.x - USER_RING_SIZE / 2,
                      top: point.y - layout.bounds.y - USER_RING_SIZE / 2,
                    },
                  ]}
                />
                {Number.isFinite(actor.headingRadians) ? (
                  <View
                    style={[
                      styles.headingCone,
                      {
                        left:
                          point.x - layout.bounds.x - HEADING_CONE_WIDTH / 2,
                        top:
                          point.y -
                          layout.bounds.y -
                          HEADING_CONE_HEIGHT +
                          6,
                        transform: [{ rotate: `${actor.headingRadians}rad` }],
                      },
                    ]}
                  />
                ) : null}
              </>
            ) : null}
            <Image
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
            {actor.label ? (
              <View
                style={[
                  styles.labelPill,
                  {
                    left: point.x - layout.bounds.x - 26,
                    top: point.y - layout.bounds.y + 8,
                  },
                ]}
              >
                <Text style={styles.labelText}>{actor.label}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  actor: {
    position: 'absolute',
    zIndex: 24,
  },
  ring: {
    position: 'absolute',
    zIndex: 20,
    width: USER_RING_SIZE,
    height: USER_RING_SIZE,
    borderRadius: USER_RING_SIZE / 2,
    borderWidth: 3.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(54, 140, 255, 0.2)',
  },
  headingCone: {
    position: 'absolute',
    zIndex: 18,
    width: 0,
    height: 0,
    borderLeftWidth: HEADING_CONE_WIDTH / 2,
    borderRightWidth: HEADING_CONE_WIDTH / 2,
    borderBottomWidth: HEADING_CONE_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(76, 169, 255, 0.34)',
    opacity: 0.95,
  },
  labelPill: {
    position: 'absolute',
    zIndex: 25,
    minHeight: 24,
    minWidth: 52,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    ...shadow,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
});
