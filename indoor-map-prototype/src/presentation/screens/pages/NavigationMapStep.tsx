import React from 'react';
import {
  GestureResponderHandlers,
  LayoutChangeEvent,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  DestinationAnchor,
  FloorOption,
  FlowState,
  NavigationTelemetry,
  ParsedMapFloor,
  Point,
  RouteModel,
  TransformState,
} from '../../../shared/types';
import { colors, radii, spacing } from '../../../shared/theme/tokens';
import { PrimaryActionButton, SecondaryActionButton } from '../../components/controls/ActionButtons';
import FloatingControls from '../../components/controls/FloatingControls';
import IndoorMapCanvas from '../../components/map/IndoorMapCanvas';

interface NavigationMapStepProps {
  activeFloorId: string;
  floor: ParsedMapFloor;
  floors: FloorOption[];
  mapState: FlowState;
  route: RouteModel | null;
  selectedDestination: DestinationAnchor | null;
  transform: TransformState;
  userPosition: Point;
  telemetry: NavigationTelemetry;
  panHandlers: GestureResponderHandlers;
  onLayout: (event: LayoutChangeEvent) => void;
  onBack: () => void;
  onSelectFloor: (floorId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onEnd: () => void;
  onNewRoute: () => void;
}

export function NavigationMapStep({
  activeFloorId,
  floor,
  floors,
  mapState,
  route,
  selectedDestination,
  transform,
  userPosition,
  telemetry,
  panHandlers,
  onLayout,
  onBack,
  onSelectFloor,
  onZoomIn,
  onZoomOut,
  onRecenter,
  onEnd,
  onNewRoute,
}: NavigationMapStepProps) {
  const headingLabel =
    telemetry.headingDegrees == null ? 'Calibrating' : `${Math.round(telemetry.headingDegrees)} deg`;

  return (
    <View style={styles.mapPage}>
      <IndoorMapCanvas
        floor={floor}
        state={mapState}
        transform={transform}
        userPosition={userPosition}
        headingDegrees={telemetry.headingDegrees}
        selectedDestination={selectedDestination}
        route={route}
        panHandlers={panHandlers}
        onLayout={onLayout}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={styles.mapTopBar}>
          <TouchableOpacity activeOpacity={0.88} onPress={onBack} style={styles.mapIconButton}>
            <Text style={styles.mapIconLabel}>{mapState === 'arrived' ? 'Done' : 'Back'}</Text>
          </TouchableOpacity>

          <View style={styles.mapRouteBar}>
            <Text style={styles.mapRouteTitle}>{selectedDestination?.label ?? 'Destination'}</Text>
            <Text style={styles.mapRouteMeta}>
              {mapState === 'arrived'
                ? 'Destination reached'
                : `${route?.etaMinutes ?? 0} min / ${route?.distanceMeters ?? 0} m`}
            </Text>
          </View>

          <View style={styles.mapStatusPill}>
            <Text style={styles.mapStatusText}>{floor.label}</Text>
          </View>
        </View>

        <View style={styles.telemetryWrap}>
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryHeaderRow}>
              <Text style={styles.telemetryTitle}>{telemetry.modeLabel}</Text>
              <View
                style={[
                  styles.telemetryStatusDot,
                  telemetry.status === 'active'
                    ? styles.telemetryStatusActive
                    : telemetry.status === 'fallback'
                      ? styles.telemetryStatusFallback
                      : telemetry.status === 'permission-denied' || telemetry.status === 'unavailable'
                        ? styles.telemetryStatusBlocked
                        : styles.telemetryStatusIdle,
                ]}
              />
            </View>
            <Text style={styles.telemetryDetail}>{telemetry.detailLabel}</Text>
            <View style={styles.telemetryMetricsRow}>
              <View style={styles.telemetryMetric}>
                <Text style={styles.telemetryMetricLabel}>Steps</Text>
                <Text style={styles.telemetryMetricValue}>{telemetry.stepCount}</Text>
              </View>
              <View style={styles.telemetryMetric}>
                <Text style={styles.telemetryMetricLabel}>Heading</Text>
                <Text style={styles.telemetryMetricValue}>{headingLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <FloatingControls
          floors={floors}
          activeFloorId={activeFloorId}
          onSelectFloor={onSelectFloor}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onRecenter={onRecenter}
        />

        {mapState === 'arrived' ? (
          <View style={styles.arrivalBannerWrap}>
            <View style={styles.arrivalBanner}>
              <Text style={styles.arrivalTitle}>Arrived at {selectedDestination?.label}</Text>
              <View style={styles.arrivalActions}>
                <View style={styles.arrivalActionItem}>
                  <SecondaryActionButton label="End" onPress={onEnd} />
                </View>
                <View style={styles.arrivalActionItem}>
                  <PrimaryActionButton label="New route" onPress={onNewRoute} />
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapPage: {
    flex: 1,
    backgroundColor: colors.mapChrome,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mapTopBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapIconButton: {
    minWidth: 62,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
  },
  mapIconLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  mapRouteBar: {
    flex: 1,
    height: 52,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
  },
  mapRouteTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  mapRouteMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  mapStatusPill: {
    minWidth: 56,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 24, 38, 0.88)',
  },
  mapStatusText: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '700',
  },
  telemetryWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  telemetryCard: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(248, 251, 255, 0.94)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  telemetryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  telemetryStatusDot: {
    width: 11,
    height: 11,
    borderRadius: radii.pill,
  },
  telemetryStatusActive: {
    backgroundColor: colors.accentGreen,
  },
  telemetryStatusFallback: {
    backgroundColor: colors.accentAmber,
  },
  telemetryStatusBlocked: {
    backgroundColor: colors.accentRose,
  },
  telemetryStatusIdle: {
    backgroundColor: colors.textMuted,
  },
  telemetryDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  telemetryMetricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  telemetryMetric: {
    minWidth: 70,
  },
  telemetryMetricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  telemetryMetricValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  arrivalBannerWrap: {
    marginTop: 'auto',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  arrivalBanner: {
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
    borderRadius: radii.lg,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  arrivalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  arrivalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  arrivalActionItem: {
    flex: 1,
  },
});
