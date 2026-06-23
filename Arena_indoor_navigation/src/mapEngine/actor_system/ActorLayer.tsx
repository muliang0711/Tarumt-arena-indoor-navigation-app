import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
import type { Bounds, MapCoordinateSystem } from '../shared';
import {
  bobFacingFanAsset,
  bobIdleAssets,
  bobRunAssets,
} from './actorAssetRegistry';
import { Actor, routeNodeToPixels } from './actorModel';
import { fanRotationDegrees } from './facingFanModel';

type ActorLayerLayout = {
  bounds: Bounds;
};

type ActorLayerProps = {
  actors: Actor[];
  layout: ActorLayerLayout;
  coordinateSystem: MapCoordinateSystem;
};

const BOB_SIZE = 32;
const FACING_FAN_SIZE = 128;
const RUN_FRAME_MS = 110;
const USER_RING_SIZE = 50;

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
                {Number.isFinite(actor.headingRadians) ? (
                  <Image
                    source={bobFacingFanAsset}
                    resizeMode="contain"
                    style={[
                      styles.facingFan,
                      {
                        left:
                          point.x -
                          layout.bounds.x -
                          FACING_FAN_SIZE / 2,
                        top:
                          point.y -
                          layout.bounds.y -
                          FACING_FAN_SIZE / 2,
                        width: FACING_FAN_SIZE,
                        height: FACING_FAN_SIZE,
                        transform: [
                          {
                            rotate: `${fanRotationDegrees(actor.headingRadians)}deg`,
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.ring,
                    {
                      left: point.x - layout.bounds.x - USER_RING_SIZE / 2,
                      top: point.y - layout.bounds.y - USER_RING_SIZE / 2,
                    },
                  ]}
                />
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
  facingFan: {
    position: 'absolute',
    zIndex: 18,
  },
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
