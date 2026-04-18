import React from 'react';
import {
  GestureResponderHandlers,
  LayoutChangeEvent,
  SafeAreaView,
  StyleSheet,
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
import { colors } from '../../../shared/theme/tokens';
import IndoorMapCanvas from '../../components/map/IndoorMapCanvas';
import { NavigationMapBottomPanel } from '../../components/map/NavigationMapBottomPanel';
import { NavigationMapLocateButton } from '../../components/map/NavigationMapLocateButton';
import { NavigationMapTopOverlay } from '../../components/map/NavigationMapTopOverlay';

interface NavigationMapStepProps {
  activeFloorId: string;
  floor: ParsedMapFloor;
  floors: FloorOption[];
  mapState: FlowState;
  route: RouteModel | null;
  routeProgress: number;
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
  routeProgress,
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
  const handleExit = mapState === 'arrived' ? onEnd : onBack;

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
        <NavigationMapTopOverlay
          floorLabel={floor.label}
          headingLabel={headingLabel}
          detailLabel={telemetry.detailLabel}
          mapState={mapState}
          modeLabel={telemetry.modeLabel}
          route={route}
          status={telemetry.status}
        />

        <NavigationMapLocateButton onPress={onRecenter} />

        <NavigationMapBottomPanel
          mapState={mapState}
          route={route}
          routeProgress={routeProgress}
          selectedDestination={selectedDestination}
          onExit={handleExit}
        />
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
});
