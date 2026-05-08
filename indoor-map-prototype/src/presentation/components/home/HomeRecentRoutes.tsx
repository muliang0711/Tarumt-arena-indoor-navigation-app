import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { DashboardGlassPanel } from '../shared/DashboardGlassPanel';

interface RecentRoute {
  title: string;
  detail: string;
  eta: string;
}

interface HomeRecentRoutesProps {
  routes: RecentRoute[];
  onSelectRoute: () => void;
}

export function HomeRecentRoutes({ routes, onSelectRoute }: HomeRecentRoutesProps) {
  return (
    <DashboardGlassPanel contentStyle={styles.recentCard}>
      <Text style={styles.blockTitle}>Recent Routes</Text>
      <View style={styles.recentList}>
        {routes.map((route, index) => (
          <Pressable
            key={route.title}
            accessibilityRole="button"
            onPress={onSelectRoute}
            style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
          >
            <View style={styles.recentMarker}>
              <Text style={styles.recentMarkerText}>{index + 1}</Text>
            </View>
            <View style={styles.recentCopy}>
              <Text style={styles.recentTitle}>{route.title}</Text>
              <Text style={styles.recentDetail}>{route.detail}</Text>
            </View>
            <Text style={styles.recentEta}>{route.eta}</Text>
          </Pressable>
        ))}
      </View>
    </DashboardGlassPanel>
  );
}

const styles = StyleSheet.create({
  recentCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  recentList: {
    gap: spacing.xs,
  },
  recentRow: {
    minHeight: 54,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.74)',
  },
  recentMarker: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMarkerText: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '900',
  },
  recentCopy: {
    flex: 1,
  },
  recentTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  recentDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  recentEta: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
