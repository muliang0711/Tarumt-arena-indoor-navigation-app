import { Image, StyleSheet } from 'react-native';

import type { RoutePosition } from '../../../tiled/type';
import { BOB_ACTOR } from './actorDefinition';
import type { ActorDefinition } from './actorDefinition';
import { useActorFacingDirection } from './useActorFacingDirection';
import { useActorWalkAnimation } from './useActorWalkAnimation';

type ActorSpriteProps = {
  actor?: ActorDefinition;
  facingHeadingDegrees: number;
  position: RoutePosition;
};

export function ActorSprite({
  actor = BOB_ACTOR,
  facingHeadingDegrees,
  position,
}: ActorSpriteProps) {
  const direction = useActorFacingDirection(facingHeadingDegrees);
  const walkingFrames = actor.walking[direction];
  const { frameIndex, isWalking } = useActorWalkAnimation({
    frameCount: walkingFrames.length,
    frameDurationMs: actor.frameDurationMs,
    movementIdleDelayMs: actor.movementIdleDelayMs,
    screenX: position.screenX,
    screenY: position.screenY,
  });
  const source = isWalking
    ? walkingFrames[frameIndex] ?? walkingFrames[0] ?? actor.idle[direction]
    : actor.idle[direction];

  return (
    <Image
      resizeMode="stretch"
      source={source}
      style={[
        styles.sprite,
        {
          height: actor.displayHeight,
          left: -actor.displayWidth / 2,
          top: -actor.displayHeight,
          width: actor.displayWidth,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  sprite: {
    position: 'absolute',
  },
});
