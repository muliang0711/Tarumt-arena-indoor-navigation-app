import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';

interface HomeQuickDestinationsProps {
  destinations: string[];
  onSelectDestination: () => void;
}

export function HomeQuickDestinations({
  destinations,
  onSelectDestination,
}: HomeQuickDestinationsProps) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.blockTitle}>Quick Destinations</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickList}
      >
        {destinations.map((destination) => (
          <Pressable
            key={destination}
            accessibilityRole="button"
            onPress={onSelectDestination}
            style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
          >
            <Text style={styles.quickChipText}>{destination}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: spacing.sm,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  quickList: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  quickChip: {
    minHeight: 40,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});
