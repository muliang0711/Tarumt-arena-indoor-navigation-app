import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, FlowState, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { SecondaryActionButton } from '../controls/ActionButtons';

interface NavigationMapBottomPanelProps {
  floorLabel: string;
  mapState: FlowState;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  onExit: () => void;
}

export function NavigationMapBottomPanel({
  floorLabel,
  mapState,
  route,
  selectedDestination,
  onExit,
}: NavigationMapBottomPanelProps) {
  const summaryLabel =
    mapState === 'arrived'
      ? 'Destination reached'
      : `${route?.etaMinutes ?? 0} min / ${route?.distanceMeters ?? 0} m`;

  const detailLabel =
    mapState === 'arrived' ? 'You can leave the live map now.' : route?.instruction ?? 'Follow the route highlight.';

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <View style={styles.infoRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.destinationLabel}>Destination</Text>
            <Text style={styles.destinationTitle} numberOfLines={1}>
              {selectedDestination?.label ?? 'Destination'}
            </Text>
            <Text style={styles.summaryText}>{summaryLabel}</Text>
            <Text style={styles.detailText} numberOfLines={2}>
              {detailLabel}
            </Text>
          </View>

          <View style={styles.floorPill}>
            <Text style={styles.floorPillLabel}>Floor</Text>
            <Text style={styles.floorPillValue}>{floorLabel}</Text>
          </View>
        </View>

        <SecondaryActionButton label="Exit map" onPress={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 'auto',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  panel: {
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(248, 251, 255, 0.94)',
    borderWidth: 1,
    borderColor: colors.glassStroke,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  destinationLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  destinationTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  floorPill: {
    minWidth: 70,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  floorPillLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  floorPillValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
});
