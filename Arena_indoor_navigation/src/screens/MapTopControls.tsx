import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../components/theme';

type MapTopControlsProps = {
  floorLabel: string;
  followsBob: boolean;
  sensorStatus: 'starting' | 'receiving' | 'unavailable' | 'error';
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFollowBob: () => void;
};

export function MapTopControls({
  floorLabel,
  followsBob,
  sensorStatus,
  onZoomIn,
  onZoomOut,
  onToggleFollowBob,
}: MapTopControlsProps) {
  return (
    <View style={styles.topControls}>
      <View style={styles.floorPill}>
        <Text style={styles.floorText}>{floorLabel}</Text>
      </View>
      <View style={styles.topControlsRight}>
        <View
          style={[
            styles.sensorPill,
            sensorStatus === 'receiving' && styles.sensorPillLive,
            sensorStatus === 'error' && styles.sensorPillError,
          ]}
        >
          <Text
            style={[
              styles.sensorText,
              sensorStatus === 'receiving' && styles.sensorTextLive,
            ]}
          >
            {sensorStatus === 'starting'
              ? 'Sensors starting'
              : sensorStatus === 'receiving'
                ? 'Sensors live'
                : sensorStatus === 'error'
                  ? 'Sensor error'
                  : 'Sensors unavailable'}
          </Text>
        </View>
        <Pressable style={styles.controlButton} onPress={onZoomIn}>
          <Text style={styles.controlButtonText}>+</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={onZoomOut}>
          <Text style={styles.controlButtonText}>-</Text>
        </Pressable>
        <Pressable
          style={[styles.followButton, followsBob && styles.followButtonActive]}
          onPress={onToggleFollowBob}
        >
          <Text style={[styles.followButtonText, followsBob && styles.followButtonTextActive]}>
            {followsBob ? 'Following Bob' : 'Free look'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floorPill: {
    minWidth: 104,
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  floorText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  controlButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  sensorPill: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orangeSoft,
  },
  sensorPillLive: {
    backgroundColor: colors.greenSoft,
  },
  sensorPillError: {
    backgroundColor: colors.orangeSoft,
  },
  sensorText: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: '900',
  },
  sensorTextLive: {
    color: colors.green,
  },
  controlButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  followButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  followButtonActive: {
    backgroundColor: colors.green,
  },
  followButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  followButtonTextActive: {
    color: '#ffffff',
  },
});
