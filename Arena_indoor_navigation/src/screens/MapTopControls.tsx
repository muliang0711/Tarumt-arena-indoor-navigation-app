import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../components/theme';

type MapTopControlsProps = {
  floorLabel: string;
  followsBob: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFollowBob: () => void;
};

export function MapTopControls({
  floorLabel,
  followsBob,
  onZoomIn,
  onZoomOut,
  onToggleFollowBob,
}: MapTopControlsProps) {
  return (
    <View style={styles.topControls}>
      <View style={styles.floorPill}>
        <Ionicons name="layers" size={17} color={colors.text} />
        <Text style={styles.floorText}>{floorLabel}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.text} />
      </View>
      <View style={styles.topControlsRight}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          style={styles.controlButton}
          onPress={onZoomIn}
        >
          <Text style={styles.controlButtonText}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          style={styles.controlButton}
          onPress={onZoomOut}
        >
          <Text style={styles.controlButtonText}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={followsBob ? 'Following Bob' : 'Recenter map'}
          style={[styles.followButton, followsBob && styles.followButtonActive]}
          onPress={onToggleFollowBob}
        >
          <Text style={[styles.followButtonText, followsBob && styles.followButtonTextActive]}>
            {followsBob ? 'Following Bob' : 'Recenter'}
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
    gap: 7,
  },
  floorPill: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  floorText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  controlButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  controlButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  followButton: {
    minHeight: 38,
    maxWidth: 112,
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
