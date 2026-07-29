import { Animated, StyleSheet } from 'react-native';

import type { RoutePosition } from '../../../tiled/type';
import { useAnimatedMarkerStyle } from '../useAnimatedMarkerStyle';
import { BOB_ACTOR } from './actorDefinition';
import type { ActorDefinition } from './actorDefinition';
import { ActorSprite } from './ActorSprite';

type ActorMarkerProps = {
  actor?: ActorDefinition;
  facingHeadingDegrees: number;
  position: RoutePosition;
};

export function ActorMarker({
  actor = BOB_ACTOR,
  facingHeadingDegrees,
  position,
}: ActorMarkerProps) {
  const animatedStyle = useAnimatedMarkerStyle({
    anchorX: 0,
    anchorY: 0,
    headingDegrees: 0,
    height: 0,
    rotateWithHeading: false,
    screenX: position.screenX,
    screenY: position.screenY,
    width: 0,
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.actor, animatedStyle]}>
      <ActorSprite
        actor={actor}
        facingHeadingDegrees={facingHeadingDegrees}
        position={position}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actor: {
    position: 'absolute',
  },
});
