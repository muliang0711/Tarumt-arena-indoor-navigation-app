import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import IndoorMapCanvas from '../components/map/IndoorMapCanvas';
import FloatingControls from '../components/ui/FloatingControls';
import StateBottomSheet from '../components/ui/StateBottomSheet';
import { MAP_ASSET_REGISTRY, MAP_PACKAGE_JSON } from '../data/mapReference';
import {
  buildPrototypeScenario,
  buildRouteToDestination,
  interpolateRoutePosition,
} from '../data/navigationScenario';
import { useMapViewport } from '../hooks/useMapViewport';
import { colors, radii, spacing } from '../theme/tokens';
import type { FlowState } from '../types';
import { parseIndoorMapPackage } from '../utils/mapParser';

const floor = parseIndoorMapPackage(MAP_PACKAGE_JSON, MAP_ASSET_REGISTRY);
const scenario = buildPrototypeScenario(floor);

export default function IndoorMapPrototypeScreen() {
  const [state, setState] = useState<FlowState>('detected');
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
    if (!route || (state !== 'navigating' && state !== 'arrived')) {
      return scenario.currentPosition;
    }

    return interpolateRoutePosition(route.points, state === 'arrived' ? 1 : routeProgress);
  }, [route, routeProgress, state]);

  const { transform, onLayout, panHandlers, zoomBy, centerOn, fitToBounds } = useMapViewport({
    worldWidth: floor.worldWidth,
    worldHeight: floor.worldHeight,
    focusBounds: floor.focusBounds,
  });

  useEffect(() => {
    if (!selectedDestination) {
      return;
    }

    centerOn(selectedDestination.roomCenter, 1.1);
  }, [centerOn, selectedDestinationId, selectedDestination]);

  useEffect(() => {
    if (state !== 'navigating') {
      return;
    }

    const timer = setInterval(() => {
      setRouteProgress((current) => {
        const next = Math.min(current + 0.025, 1);
        if (next >= 1) {
          setState('arrived');
        }
        return next;
      });
    }, 90);

    return () => clearInterval(timer);
  }, [state]);

  const handleConfirmIndoor = () => {
    setState('confirmed');
    fitToBounds();
  };

  const handleSelectDestination = (destinationId: string) => {
    setSelectedDestinationId(destinationId);
    setRouteProgress(0);
    if (state === 'arrived') {
      setState('confirmed');
    }
  };

  const handleStartNavigation = () => {
    if (!selectedDestination || !route) {
      return;
    }

    setRouteProgress(0);
    setState('navigating');
    centerOn(selectedDestination.roomCenter, Math.max(transform.scale, 1.2));
  };

  const handleRestart = () => {
    setRouteProgress(0);
    setState('confirmed');
    if (selectedDestination) {
      centerOn(selectedDestination.roomCenter, Math.max(transform.scale, 1.08));
    }
  };

  const handleEndNavigation = () => {
    setRouteProgress(0);
    setState('detected');
    fitToBounds();
  };

  return (
    <View style={styles.container}>
      <IndoorMapCanvas
        floor={floor}
        state={state}
        transform={transform}
        userPosition={userPosition}
        selectedDestination={selectedDestination}
        route={route}
        panHandlers={panHandlers}
        onLayout={onLayout}
      />

      <View pointerEvents="box-none" style={styles.topChrome}>
        <View style={styles.searchPanel}>
          <Text style={styles.eyebrow}>Campus indoor navigation</Text>
          <Text style={styles.heading}>Student Center</Text>
          <Text style={styles.subheading}>Map first routing for iPhone 15 review</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipLabel}>
              {state === 'detected'
                ? 'Indoor detected'
                : state === 'confirmed'
                  ? 'Ready to route'
                  : state === 'navigating'
                    ? 'Active route'
                    : 'Arrived'}
            </Text>
          </View>

          <View style={styles.floorChip}>
            <Text style={styles.floorChipLabel}>{floor.label}</Text>
          </View>
        </View>
      </View>

      <FloatingControls
        floors={scenario.floors}
        activeFloorId={activeFloorId}
        onSelectFloor={setActiveFloorId}
        onZoomIn={() => zoomBy(0.22)}
        onZoomOut={() => zoomBy(-0.22)}
        onRecenter={() => centerOn(userPosition, Math.max(transform.scale, 1.05))}
      />

      <StateBottomSheet
        state={state}
        buildingName={scenario.buildingName}
        floorLabel={scenario.detectedFloorLabel}
        currentLocationLabel={scenario.currentLocationLabel}
        selectedDestination={selectedDestination}
        destinations={scenario.destinations}
        route={route}
        onConfirmIndoor={handleConfirmIndoor}
        onStartNavigation={handleStartNavigation}
        onSelectDestination={handleSelectDestination}
        onRestart={handleRestart}
        onEndNavigation={handleEndNavigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mapChrome,
  },
  topChrome: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  searchPanel: {
    backgroundColor: 'rgba(14, 24, 38, 0.86)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    shadowColor: colors.mapShadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
  eyebrow: {
    color: 'rgba(231, 240, 252, 0.72)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heading: {
    color: colors.textOnDark,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  subheading: {
    color: 'rgba(231, 240, 252, 0.76)',
    fontSize: 14,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 252, 255, 0.92)',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGreen,
  },
  statusChipLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  floorChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(14, 24, 38, 0.82)',
  },
  floorChipLabel: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '700',
  },
});
