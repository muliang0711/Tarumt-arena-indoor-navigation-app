import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { radius, shadow } from './theme';

export function MapRouteInstructionCard() {
  return (
    <View style={styles.card}>
      <View style={styles.directionIcon}>
        <Ionicons name="arrow-up" size={28} color="#ffffff" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Go straight 6 m</Text>
        <View style={styles.nextRow}>
          <Text style={styles.next}>Then turn right</Text>
          <Ionicons name="return-up-forward" size={17} color="#dce7f1" />
        </View>
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
    padding: 12,
    flexDirection: 'row',
    gap: 11,
    borderRadius: radius.md,
    backgroundColor: 'rgba(21, 39, 57, 0.94)',
    ...shadow,
  },
  directionIcon: {
    width: 44,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#1478db',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  nextRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  next: {
    color: '#dce7f1',
    fontSize: 12,
    fontWeight: '700',
  },
  dots: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
});
