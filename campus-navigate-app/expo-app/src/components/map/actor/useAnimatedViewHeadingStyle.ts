import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { closestViewHeadingTarget } from './viewHeadingModel';

export function useAnimatedViewHeadingStyle(headingDegrees: number) {
  const animatedHeading = useRef(new Animated.Value(headingDegrees));
  const headingTargetRef = useRef(headingDegrees);

  useEffect(() => {
    const nextHeading = closestViewHeadingTarget(
      headingTargetRef.current,
      headingDegrees,
    );
    headingTargetRef.current = nextHeading;
    const animation = Animated.timing(animatedHeading.current, {
      duration: 180,
      easing: Easing.linear,
      toValue: nextHeading,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [headingDegrees]);

  return {
    transform: [
      {
        rotate: animatedHeading.current.interpolate({
          inputRange: [-3600, 3600],
          outputRange: ['-3600deg', '3600deg'],
        }),
      },
    ],
  };
}
