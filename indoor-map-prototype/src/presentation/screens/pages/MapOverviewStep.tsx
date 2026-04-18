import React from 'react';
import {
  GestureResponderHandlers,
  LayoutChangeEvent,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';

import type { FloorOption, ParsedMapFloor, Point, TransformState } from '../../../shared/types';
import { colors, spacing } from '../../../shared/theme/tokens';
import IndoorMapCanvas from '../../components/map/IndoorMapCanvas';
import { MapOverviewTopPanel } from '../../components/map/MapOverviewTopPanel';
import { ActionDock } from '../../components/shared/ActionDock';

interface MapOverviewStepProps {
  activeFloorId: string;
  floor: ParsedMapFloor;
  floors: FloorOption[];
  transform: TransformState;
  userPosition: Point;
  headingDegrees: number | null;
  panHandlers: GestureResponderHandlers;
  onLayout: (event: LayoutChangeEvent) => void;
  onGoHome: () => void;
  onStart: () => void;
  onSelectFloor: (floorId: string) => void;
}

export function MapOverviewStep({
  activeFloorId,
  floor,
  floors,
  transform,
  userPosition,
  headingDegrees,
  panHandlers,
  onLayout,
  onGoHome,
  onStart,
  onSelectFloor,
}: MapOverviewStepProps) {
  return (
    <View style={styles.page}>
      <IndoorMapCanvas
        floor={floor}
        state="detected"
        transform={transform}
        userPosition={userPosition}
        headingDegrees={headingDegrees}
        selectedDestination={null}
        route={null}
        panHandlers={panHandlers}
        onLayout={onLayout}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <MapOverviewTopPanel
          activeFloorId={activeFloorId}
          floors={floors}
          onSelectFloor={onSelectFloor}
        />

        <View style={styles.bottomWrap}>
          <ActionDock
            activeItemId="map"
            onHomePress={onGoHome}
            onStartPress={onStart}
            onMapPress={() => {}}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.mapChrome,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomWrap: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
});
