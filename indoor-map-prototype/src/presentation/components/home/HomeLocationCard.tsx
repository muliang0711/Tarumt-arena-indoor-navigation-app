import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { DashboardGlassPanel } from '../shared/DashboardGlassPanel';

interface HomeLocationCardProps {
  currentLocationLabel: string;
}

export function HomeLocationCard({ currentLocationLabel }: HomeLocationCardProps) {
  return (
    <DashboardGlassPanel contentStyle={styles.locationCard}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionEyebrow}>Current Location</Text>
          <Text style={styles.locationTitle}>Student Center · Level 3</Text>
          <Text style={styles.locationSubtitle}>{currentLocationLabel}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceLabel}>Confidence</Text>
          <Text style={styles.confidenceValue}>High</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCell label="Last updated" value="3s ago" />
        <MetricCell label="Nearest Lift A" value="18m" />
        <MetricCell label="Available Routes" value="12" />
      </View>
    </DashboardGlassPanel>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  locationCard: {
    padding: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  locationTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 0,
  },
  locationSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  confidenceBadge: {
    minWidth: 92,
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentGreenSoft,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  confidenceLabel: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
  confidenceValue: {
    color: '#065F46',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  metricsGrid: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCell: {
    flex: 1,
    minHeight: 64,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(217, 226, 242, 0.72)',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
});
