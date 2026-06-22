import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, shadow } from './theme';

export function MapRouteInstructionCard() {
  const [expanded, setExpanded] = useState(true);

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Expand route instruction"
        hitSlop={8}
        style={({ pressed }) => [
          styles.compactButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => setExpanded(true)}
      >
        <Ionicons name="navigate" size={24} color="#ffffff" />
        <View style={styles.expandBadge}>
          <Ionicons name="expand-outline" size={11} color="#ffffff" />
        </View>
      </Pressable>
    );
  }

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Collapse route instruction"
        hitSlop={8}
        style={({ pressed }) => [
          styles.collapseButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => setExpanded(false)}
      >
        <Ionicons name="contract-outline" size={15} color="#ffffff" />
      </Pressable>
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
  compactButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#1478db',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    ...shadow,
  },
  expandBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#152739',
  },
  buttonPressed: {
    opacity: 0.76,
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
    paddingRight: 16,
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
  collapseButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
});
