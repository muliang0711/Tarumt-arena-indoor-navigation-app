import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DestinationAnchor, RouteModel } from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { HeaderSystemRow } from '../../components/shared/HeaderSystemRow';
import { DashboardBottomNavigation } from '../../components/shared/DashboardBottomNavigation';
import { DashboardFloorPlanBackground } from '../../components/shared/DashboardFloorPlanBackground';
import { DashboardGlassPanel } from '../../components/shared/DashboardGlassPanel';
import { MapIcon, RouteIcon, ScanIcon } from '../../components/shared/DashboardIcons';
import { DashboardRoutePreview } from '../../components/shared/DashboardRoutePreview';

interface ConfirmStepProps {
  buildingName: string;
  currentLocationLabel: string;
  floorLabel: string;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  onGoHome: () => void;
  onChooseAnother: () => void;
  onOpenOverviewMap: () => void;
  onOpenMap: () => void;
}

export function ConfirmStep({
  buildingName,
  currentLocationLabel,
  floorLabel,
  route,
  selectedDestination,
  onGoHome,
  onChooseAnother,
  onOpenOverviewMap,
  onOpenMap,
}: ConfirmStepProps) {
  const destinationName = selectedDestination?.label ?? 'Unknown destination';
  const destinationType = selectedDestination?.subtitle ?? 'Indoor destination';
  const destinationFloor = selectedDestination?.floorLabel ?? floorLabel;
  const distanceMeters = route?.distanceMeters ?? 0;
  const etaMinutes = route?.etaMinutes ?? 0;

  return (
    <ScreenShell>
      <View style={styles.root}>
        <DashboardFloorPlanBackground />

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerBlock}>
            <HeaderSystemRow />
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Confirm route</Text>
                <Text style={styles.subtitle}>
                  Review the route details before starting indoor guidance.
                </Text>
              </View>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Ready</Text>
              </View>
            </View>
          </View>

          <DashboardGlassPanel contentStyle={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View style={styles.destinationIcon}>
                <RouteIcon color={colors.accentBlue} />
              </View>
              <View style={styles.destinationCopy}>
                <Text style={styles.cardEyebrow}>Destination</Text>
                <Text style={styles.destinationTitle}>{destinationName}</Text>
                <Text style={styles.destinationType}>{destinationType}</Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCell label="Walk time" value={`${etaMinutes} min`} />
              <MetricCell label="Distance" value={`${distanceMeters}m`} />
              <MetricCell label="Confidence" value="High" />
            </View>

            <View style={styles.infoList}>
              <InfoRow label="From" value={currentLocationLabel} />
              <InfoRow label="Building" value={buildingName} />
              <InfoRow label="Floor" value={destinationFloor} />
              <InfoRow label="Room type" value={destinationType} />
            </View>
          </DashboardGlassPanel>

          <DashboardGlassPanel contentStyle={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.blockTitle}>Route Preview</Text>
                <Text style={styles.previewSubtitle}>Start point to selected room</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenOverviewMap}
                style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}
              >
                <MapIcon color={colors.accentBlue} />
                <Text style={styles.smallActionText}>Map</Text>
              </Pressable>
            </View>
            <DashboardRoutePreview />
            <View style={styles.routeEndpoints}>
              <EndpointDot color={colors.accentBlue} label="Start" value={currentLocationLabel} />
              <EndpointDot color={colors.accentGreen} label="End" value={destinationName} />
            </View>
          </DashboardGlassPanel>

          <DashboardGlassPanel contentStyle={styles.detailsCard}>
            <Text style={styles.blockTitle}>Route Details</Text>
            <View style={styles.detailGrid}>
              <DetailPill title="Turns" value="3 turns" />
              <DetailPill title="Access" value="Lift route available" />
              <DetailPill title="Updates" value="Re-route if position changes" />
            </View>
            <Text style={styles.routeInstruction}>
              {route?.instruction ??
                'Follow the highlighted corridor and keep positioning active while walking.'}
            </Text>
          </DashboardGlassPanel>

          <View style={styles.actionStack}>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenMap}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <RouteIcon color={colors.white} />
              <Text style={styles.primaryButtonText}>Start Navigation</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenOverviewMap}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <MapIcon color={colors.accentBlue} />
              <Text style={styles.secondaryButtonText}>Preview on Map</Text>
            </Pressable>
            <View style={styles.tertiaryRow}>
              <Pressable
                accessibilityRole="button"
                onPress={onChooseAnother}
                style={({ pressed }) => [styles.tertiaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.tertiaryButtonText}>Choose another destination</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onGoHome}
                style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
              >
                <ScanIcon color={colors.textSecondary} />
                <Text style={styles.scanButtonText}>Scan Anchor</Text>
              </Pressable>
            </View>
          </View>

          <DashboardGlassPanel contentStyle={styles.helperNote}>
            <Text style={styles.helperTitle}>Before you start</Text>
            <Text style={styles.helperText}>
              Keep the app open while walking. The route will refresh automatically when your
              indoor position changes.
            </Text>
          </DashboardGlassPanel>
        </ScrollView>

        <DashboardBottomNavigation
          activeTabId="map"
          onHomePress={onGoHome}
          onSearchPress={onChooseAnother}
          onMapPress={onOpenOverviewMap}
        />
      </View>
    </ScreenShell>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EndpointDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.endpointRow}>
      <View style={[styles.endpointDot, { backgroundColor: color }]} />
      <View style={styles.endpointCopy}>
        <Text style={styles.endpointLabel}>{label}</Text>
        <Text style={styles.endpointValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DetailPill({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailTitle}>{title}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 116,
    gap: spacing.md,
  },
  headerBlock: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  statusPill: {
    minHeight: 32,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(236, 253, 245, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGreen,
  },
  statusText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  summaryTopRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  destinationIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationCopy: {
    flex: 1,
    gap: 2,
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  destinationTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  destinationType: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCell: {
    flex: 1,
    minHeight: 60,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.84)',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  infoList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  previewCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  blockTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  previewSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  smallAction: {
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.accentBlueSoft,
  },
  smallActionText: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '900',
  },
  routeEndpoints: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  endpointRow: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  endpointDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
  },
  endpointCopy: {
    flex: 1,
  },
  endpointLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  endpointValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  detailsCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailPill: {
    flex: 1,
    minHeight: 68,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  detailTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  routeInstruction: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  actionStack: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    shadowColor: 'rgba(47, 107, 255, 0.42)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  tertiaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tertiaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tertiaryButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  scanButton: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  scanButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  helperNote: {
    padding: spacing.md,
    gap: 4,
  },
  helperTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
});

