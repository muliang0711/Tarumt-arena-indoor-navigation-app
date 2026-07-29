import { StyleSheet, Text } from 'react-native';

import type { OverlayRoomLabel } from '../../tiled/type';

type MapRoomLabelProps = {
  label: OverlayRoomLabel;
};

export function MapRoomLabel({ label }: MapRoomLabelProps) {
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.roomLabel,
        {
          left: label.screenX,
          minWidth: Math.max(label.width, 48),
          top: label.screenY,
        },
      ]}
    >
      {label.name}
    </Text>
  );
}

const styles = StyleSheet.create({
  roomLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 4,
    color: '#111827',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    textAlign: 'center',
  },
});
