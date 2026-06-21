import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { shadow } from '../theme';
import type { NavigationCue } from '../../mapEngine/navigation_guidance';

type MapInstructionOverlayProps = {
  cue: NavigationCue | null;
  nextCue: NavigationCue | null;
};

function iconForAction(action: NavigationCue['action'] | null) {
  switch (action) {
    case 'left':
    case 'sharp_left':
    case 'slight_left':
      return 'arrow-top-left';
    case 'right':
    case 'sharp_right':
    case 'slight_right':
      return 'arrow-top-right';
    case 'u_turn':
      return 'backup-restore';
    case 'arrived':
      return 'map-marker-check-outline';
    default:
      return 'arrow-up';
  }
}

function secondaryMessage(nextCue: NavigationCue | null): string {
  if (!nextCue) {
    return 'Keep following the highlighted route';
  }
  if (nextCue.action === 'arrived') {
    return 'Destination is just ahead';
  }
  return `Then ${nextCue.message.toLowerCase()}`;
}

export function MapInstructionOverlay({
  cue,
  nextCue,
}: MapInstructionOverlayProps) {
  if (!cue) {
    return null;
  }

  return (
    <View style={styles.card} pointerEvents="none">
      <MaterialCommunityIcons
        name={iconForAction(cue.action)}
        size={42}
        color="#1f83ff"
      />
      <View style={styles.copy}>
        <Text style={styles.primary}>{cue.message}</Text>
        <Text style={styles.secondary}>{secondaryMessage(nextCue)}</Text>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#182535',
    ...shadow,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  primary: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  secondary: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '700',
  },
  dots: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
});
