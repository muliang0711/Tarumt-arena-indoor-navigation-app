import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { DashboardGlassPanel } from '../shared/DashboardGlassPanel';
import { HomeMiniMapPreview } from './HomeMiniMapPreview';

interface HomeMapPreviewCardProps {
  onOpenMapOverview: () => void;
}

export function HomeMapPreviewCard({ onOpenMapOverview }: HomeMapPreviewCardProps) {
  return (
    <DashboardGlassPanel contentStyle={styles.mapPreviewCard}>
      <View style={styles.mapHeaderRow}>
        <View>
          <Text style={styles.blockTitle}>Level 3 Preview</Text>
          <Text style={styles.mapCaption}>West lobby to east corridor</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenMapOverview}
          style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
        >
          <Text style={styles.mapButtonText}>Open Map</Text>
        </Pressable>
      </View>
      <HomeMiniMapPreview />
    </DashboardGlassPanel>
  );
}

const styles = StyleSheet.create({
  mapPreviewCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  mapCaption: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  mapButton: {
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  mapButtonText: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
