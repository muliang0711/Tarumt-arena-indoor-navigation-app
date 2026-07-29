import { useMemo } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAnimatedViewHeadingStyle } from './useAnimatedViewHeadingStyle';
import { createViewConeGeometry } from './viewConeModel';

type UserViewConeProps = {
  color?: string;
  fieldOfViewDegrees?: number;
  headingDegrees: number;
  length?: number;
};

export function UserViewCone({
  color = '#2563eb',
  fieldOfViewDegrees = 60,
  headingDegrees,
  length = 96,
}: UserViewConeProps) {
  const geometry = useMemo(
    () => createViewConeGeometry({ fieldOfViewDegrees, length }),
    [fieldOfViewDegrees, length],
  );
  const animatedHeadingStyle = useAnimatedViewHeadingStyle(headingDegrees);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cone,
        {
          height: geometry.size,
          left: -geometry.size / 2,
          top: -geometry.size / 2,
          width: geometry.size,
        },
        animatedHeadingStyle,
      ]}
    >
      <Svg
        height={geometry.size}
        viewBox={`0 0 ${geometry.size} ${geometry.size}`}
        width={geometry.size}
      >
        <Path
          d={geometry.path}
          fill={color}
          fillOpacity={0.16}
          stroke={color}
          strokeOpacity={0.42}
          strokeWidth={2}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cone: {
    position: 'absolute',
  },
});
