import { StyleSheet, View } from 'react-native';

import type { OverlayPathSegment } from '../../tiled/type';

type MapPathSegmentProps = {
  color?: string;
  segment: OverlayPathSegment;
};

export function MapPathSegment({
  color = 'rgba(37, 99, 235, 0.62)',
  segment,
}: MapPathSegmentProps) {
  const thickness = 4;

  return (
    <View
      style={[
        styles.pathSegment,
        {
          backgroundColor: color,
          height: thickness,
          left: segment.x,
          top: segment.y - thickness / 2,
          transform: [{ rotate: `${segment.rotationDegrees}deg` }],
          width: segment.length,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pathSegment: {
    position: 'absolute',
    transformOrigin: 'left center',
  },
});
