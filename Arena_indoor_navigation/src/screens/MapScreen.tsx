import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { MapRouteInstructionCard } from '../components/MapRouteInstructionCard';
import { MapTripSummaryCard } from '../components/MapTripSummaryCard';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { radius, shadow } from '../components/theme';
import {
  ArenaMapEngineView,
  type ArenaMapDeveloperToolsSnapshot,
  type ArenaMapNavigationSnapshot,
  type ArenaMapViewportControlsSnapshot,
} from '../mapEngine/map-controller';
import { useMovementSensors } from '../sensors/useMovementSensors';
import { MapDeveloperTools } from './MapDeveloperTools';
import { MapTopControls } from './MapTopControls';

const rawMapData = require('../storage/map-assets/map.json');

export function MapScreen() {
  const sensorFeed = useMovementSensors(true);
  const [mapViewportHeight, setMapViewportHeight] = useState(1);
  const [developerToolsExpanded, setDeveloperToolsExpanded] = useState(false);
  const [navigationSnapshot, setNavigationSnapshot] =
    useState<ArenaMapNavigationSnapshot>({
      destinationLabel: 'Node 4',
      remainingDistanceMeters: 0,
      estimatedTimeSeconds: 0,
      estimatedSteps: 0,
      nextStep: 'Route unavailable',
      cue: null,
      nextCue: null,
      hasRoute: false,
    });
  const [developerToolsSnapshot, setDeveloperToolsSnapshot] =
    useState<ArenaMapDeveloperToolsSnapshot | null>(null);
  const [viewportControls, setViewportControls] =
    useState<ArenaMapViewportControlsSnapshot | null>(null);

  function handleMapLayout(event: LayoutChangeEvent) {
    const height = Math.max(1, Math.round(event.nativeEvent.layout.height));
    setMapViewportHeight((current) => (current === height ? current : height));
  }

  return (
    <ScreenScaffold scroll={false}>
      <View style={styles.page}>
        <Header compact title="Indoor Map" subtitle="Level 2 navigation" />

        <View style={styles.screenControls}>
          {viewportControls ? (
            <MapTopControls
              floorLabel={viewportControls.floorLabel}
              followsBob={viewportControls.followsBob}
              onZoomIn={viewportControls.onZoomIn}
              onZoomOut={viewportControls.onZoomOut}
              onToggleFollowBob={viewportControls.onToggleFollowBob}
            />
          ) : null}
        </View>

        <View style={styles.mapArea}>
          <View style={styles.mapViewport} onLayout={handleMapLayout}>
            <ArenaMapEngineView
              mapData={rawMapData}
              sensorSamples={sensorFeed.samples}
              latestKnownPedometerSteps={sensorFeed.latestKnownPedometerSteps}
              height={mapViewportHeight}
              resetSignal={sensorFeed.resetSignal}
              onNavigationStateChange={setNavigationSnapshot}
              onDeveloperToolsStateChange={setDeveloperToolsSnapshot}
              onViewportControlsStateChange={setViewportControls}
            />

            <View style={styles.routeOverlay} pointerEvents="box-none">
              <MapRouteInstructionCard
                cue={navigationSnapshot.cue}
                nextCue={navigationSnapshot.nextCue}
              />
            </View>
          </View>
        </View>

        <MapTripSummaryCard
          destinationLabel={navigationSnapshot.destinationLabel}
          remainingDistanceMeters={navigationSnapshot.remainingDistanceMeters}
          estimatedTimeSeconds={navigationSnapshot.estimatedTimeSeconds}
          estimatedSteps={navigationSnapshot.estimatedSteps}
          nextStep={navigationSnapshot.nextStep}
        />

        <MapDeveloperTools
          controls={sensorFeed.developmentControls}
          expanded={developerToolsExpanded}
          onToggle={() => setDeveloperToolsExpanded((current) => !current)}
          snapshot={developerToolsSnapshot}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    overflow: 'hidden',
  },
  screenControls: {
    minHeight: 38,
  },
  mapArea: {
    flex: 1,
    minHeight: 0,
  },
  mapViewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: '#ede5d8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...shadow,
  },
  routeOverlay: {
    position: 'absolute',
    zIndex: 35,
    top: 12,
    left: 12,
    width: '58%',
    maxWidth: 245,
  },
});
