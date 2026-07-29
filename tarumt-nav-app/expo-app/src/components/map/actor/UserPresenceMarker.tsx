import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import type { RoutePosition } from '../../../tiled/type';
import { useAnimatedMarkerStyle } from '../useAnimatedMarkerStyle';
import { BOB_ACTOR } from './actorDefinition';
import type { ActorDefinition } from './actorDefinition';
import { ActorSprite } from './ActorSprite';
import { UserViewCone } from './UserViewCone';
import { resolveUserFacingHeadingDegrees } from './viewHeadingModel';

type UserPresenceMarkerProps = {
  actor?: ActorDefinition;
  observedHeadingDegrees?: number | null;
  position: RoutePosition;
};

export function UserPresenceMarker({
  actor = BOB_ACTOR,
  observedHeadingDegrees,
  position,
}: UserPresenceMarkerProps) {
  const lastObservedHeadingRef = useRef(0);
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
  const actorFacingHeadingDegrees = resolveUserFacingHeadingDegrees({
    lastObservedHeadingDegrees: lastObservedHeadingRef.current,
    observedHeadingDegrees,
  });

  useEffect(() => {
    if (observedHeadingDegrees !== null && observedHeadingDegrees !== undefined) {
      lastObservedHeadingRef.current = observedHeadingDegrees;
    }
  }, [observedHeadingDegrees]);

  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, animatedStyle]}>
      {observedHeadingDegrees !== null && observedHeadingDegrees !== undefined ? (
        <UserViewCone headingDegrees={observedHeadingDegrees} />
      ) : null}
      <ActorSprite
        actor={actor}
        facingHeadingDegrees={actorFacingHeadingDegrees}
        position={position}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
});
