import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import IndoorMapCanvas from '../components/map/IndoorMapCanvas';
import FloatingControls from '../components/ui/FloatingControls';
import { MAP_ASSET_REGISTRY, MAP_PACKAGE_JSON } from '../data/mapReference';
import {
  buildPrototypeScenario,
  buildRouteToDestination,
  interpolateRoutePosition,
} from '../data/navigationScenario';
import { useMapViewport } from '../hooks/useMapViewport';
import { colors, radii, spacing } from '../theme/tokens';
import type { DestinationAnchor, FlowState } from '../types';
import { parseIndoorMapPackage } from '../utils/mapParser';

const floor = parseIndoorMapPackage(MAP_PACKAGE_JSON, MAP_ASSET_REGISTRY);
const scenario = buildPrototypeScenario(floor);

type AppPage = 'home' | 'destination' | 'confirm' | 'map';

function ScreenShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.pageHeader}>
        <View style={styles.systemRow}>
          <Text style={styles.timeText}>07:23 PM</Text>
          <View style={styles.systemChip}>
            <View style={styles.systemChipDot} />
            <Text style={styles.systemChipLabel}>System Active</Text>
          </View>
        </View>
        <Text style={styles.pageEyebrow}>{eyebrow}</Text>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function IndoorMapPrototypeScreen() {
  const [page, setPage] = useState<AppPage>('home');
  const [cameraGranted, setCameraGranted] = useState(false);
  const [mapState, setMapState] = useState<FlowState>('detected');
  const [activeFloorId, setActiveFloorId] = useState(scenario.activeFloorId);
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    scenario.destinations[1]?.id ?? scenario.destinations[0]?.id ?? '',
  );
  const [routeProgress, setRouteProgress] = useState(0);

  const selectedDestination =
    scenario.destinations.find((destination) => destination.id === selectedDestinationId) ?? null;

  const route = useMemo(() => {
    if (!selectedDestination) {
      return null;
    }

    return buildRouteToDestination(scenario.currentPosition, selectedDestination, floor.tileSize);
  }, [selectedDestination]);

  const userPosition = useMemo(() => {
    if (!route || mapState === 'detected' || mapState === 'confirmed') {
      return scenario.currentPosition;
    }

    return interpolateRoutePosition(route.points, mapState === 'arrived' ? 1 : routeProgress);
  }, [route, routeProgress, mapState]);

  const { transform, onLayout, panHandlers, zoomBy, centerOn, fitToBounds } = useMapViewport({
    worldWidth: floor.worldWidth,
    worldHeight: floor.worldHeight,
    focusBounds: floor.focusBounds,
  });

  useEffect(() => {
    if (page !== 'map') {
      return;
    }

    fitToBounds();
  }, [fitToBounds, page]);

  useEffect(() => {
    if (page !== 'map' || !selectedDestination) {
      return;
    }

    centerOn(selectedDestination.roomCenter, mapState === 'navigating' ? 1.25 : 1.08);
  }, [centerOn, mapState, page, selectedDestinationId, selectedDestination]);

  useEffect(() => {
    if (page !== 'map' || mapState !== 'navigating') {
      return;
    }

    const timer = setInterval(() => {
      setRouteProgress((current) => {
        const next = Math.min(current + 0.018, 1);
        if (next >= 1) {
          setMapState('arrived');
        }
        return next;
      });
    }, 120);

    return () => clearInterval(timer);
  }, [mapState, page]);

  const startDestinationFlow = () => {
    setPage('destination');
    setMapState('detected');
    setRouteProgress(0);
  };

  const openConfirm = () => {
    if (!selectedDestination) {
      return;
    }

    setPage('confirm');
  };

  const startNavigation = () => {
    if (!selectedDestination || !route) {
      return;
    }

    setRouteProgress(0);
    setMapState('navigating');
    setPage('map');
  };

  const resetToHome = () => {
    setRouteProgress(0);
    setMapState('detected');
    setPage('home');
    fitToBounds();
  };

  const backFromMap = () => {
    if (mapState === 'arrived') {
      resetToHome();
      return;
    }

    setMapState('confirmed');
    setPage('confirm');
  };

  const restartRoute = () => {
    setRouteProgress(0);
    setMapState('confirmed');
    setPage('destination');
  };

  if (page === 'home') {
    return (
      <ScreenShell
        eyebrow="Campus navigator"
        title="Indoor location detected"
        subtitle="Confirm your indoor position first, then choose a destination before opening the map."
      >
        <View style={styles.content}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Student Center</Text>
            <Text style={styles.heroSubtitle}>Level 3 locked with high confidence</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current anchor</Text>
              <Text style={styles.infoValue}>{scenario.currentLocationLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Camera permission</Text>
              <Text style={styles.infoValue}>{cameraGranted ? 'Granted' : 'Not requested'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Map package</Text>
              <Text style={styles.infoValue}>village_demo_01</Text>
            </View>
          </View>

          <View style={styles.actionStack}>
            <SecondaryButton
              label={cameraGranted ? 'Camera ready' : 'Request camera'}
              onPress={() => setCameraGranted(true)}
            />
            <PrimaryButton label="Start navigation" onPress={startDestinationFlow} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (page === 'destination') {
    return (
      <ScreenShell
        eyebrow="Step 1"
        title="Where do you want to go?"
        subtitle="Pick a destination before opening the map. This page keeps route selection off the navigation screen."
      >
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.destinationList}>
            {scenario.destinations.map((destination) => {
              const selected = destination.id === selectedDestinationId;
              return (
                <TouchableOpacity
                  key={destination.id}
                  activeOpacity={0.9}
                  onPress={() => setSelectedDestinationId(destination.id)}
                  style={[
                    styles.destinationCard,
                    selected && {
                      borderColor: destination.accentColor,
                      backgroundColor: `${destination.accentColor}18`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.destinationAccent,
                      { backgroundColor: destination.accentColor },
                    ]}
                  />
                  <View style={styles.destinationTextBlock}>
                    <Text style={styles.destinationTitle}>{destination.label}</Text>
                    <Text style={styles.destinationMeta}>{destination.subtitle}</Text>
                    <Text style={styles.destinationMeta}>Student Center · {floor.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actionStack}>
            <SecondaryButton label="Back" onPress={() => setPage('home')} />
            <PrimaryButton label="Continue" onPress={openConfirm} disabled={!selectedDestination} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (page === 'confirm') {
    return (
      <ScreenShell
        eyebrow="Step 2"
        title="Confirm route"
        subtitle="Review the indoor route first. The live map opens only after you confirm."
      >
        <View style={styles.content}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Destination</Text>
            <Text style={styles.confirmTitle}>{selectedDestination?.label ?? 'Unknown'}</Text>
            <Text style={styles.confirmSubtitle}>{selectedDestination?.subtitle ?? ''}</Text>

            <View style={styles.confirmDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>From</Text>
              <Text style={styles.infoValue}>{scenario.currentLocationLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Building</Text>
              <Text style={styles.infoValue}>{scenario.buildingName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Floor</Text>
              <Text style={styles.infoValue}>{floor.label}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estimated walk</Text>
              <Text style={styles.infoValue}>
                {route?.distanceMeters ?? 0} m · {route?.etaMinutes ?? 0} min
              </Text>
            </View>
          </View>

          <View style={styles.actionStack}>
            <SecondaryButton label="Choose another" onPress={() => setPage('destination')} />
            <PrimaryButton label="Open navigation map" onPress={startNavigation} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <View style={styles.mapPage}>
      <IndoorMapCanvas
        floor={floor}
        state={mapState}
        transform={transform}
        userPosition={userPosition}
        selectedDestination={selectedDestination}
        route={route}
        panHandlers={panHandlers}
        onLayout={onLayout}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={styles.mapTopBar}>
          <TouchableOpacity activeOpacity={0.88} onPress={backFromMap} style={styles.mapIconButton}>
            <Text style={styles.mapIconLabel}>{mapState === 'arrived' ? 'Done' : 'Back'}</Text>
          </TouchableOpacity>

          <View style={styles.mapRouteBar}>
            <Text style={styles.mapRouteTitle}>{selectedDestination?.label ?? 'Destination'}</Text>
            <Text style={styles.mapRouteMeta}>
              {mapState === 'arrived'
                ? 'Destination reached'
                : `${route?.etaMinutes ?? 0} min · ${route?.distanceMeters ?? 0} m`}
            </Text>
          </View>

          <View style={styles.mapStatusPill}>
            <Text style={styles.mapStatusText}>{floor.label}</Text>
          </View>
        </View>

        <FloatingControls
          floors={scenario.floors}
          activeFloorId={activeFloorId}
          onSelectFloor={setActiveFloorId}
          onZoomIn={() => zoomBy(0.22)}
          onZoomOut={() => zoomBy(-0.22)}
          onRecenter={() => centerOn(userPosition, Math.max(transform.scale, 1.08))}
        />

        {mapState === 'arrived' ? (
          <View style={styles.arrivalBannerWrap}>
            <View style={styles.arrivalBanner}>
              <Text style={styles.arrivalTitle}>Arrived at {selectedDestination?.label}</Text>
              <View style={styles.arrivalActions}>
                <SecondaryButton label="End" onPress={resetToHome} />
                <PrimaryButton label="New route" onPress={restartRoute} />
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F7FAFE',
  },
  pageHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  systemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentGreenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemChipDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGreen,
  },
  systemChipLabel: {
    color: colors.accentGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  pageEyebrow: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 8,
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  actionStack: {
    gap: spacing.sm,
    marginTop: 'auto',
  },
  primaryButton: {
    height: 54,
    borderRadius: radii.md,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  destinationList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  destinationCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  destinationAccent: {
    width: 14,
    alignSelf: 'stretch',
    borderRadius: radii.pill,
  },
  destinationTextBlock: {
    flex: 1,
    gap: 4,
  },
  destinationTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  destinationMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
    gap: spacing.md,
  },
  confirmLabel: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  confirmSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
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
});
