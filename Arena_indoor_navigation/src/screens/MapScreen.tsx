import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NavigationSummaryCard } from '../components/navigation/NavigationSummaryCard';
import { ScreenScaffold } from '../components/ScreenScaffold';
import {
  ArenaMapEngineView,
  type ArenaMapDeveloperToolsSnapshot,
  type ArenaMapNavigationSnapshot,
  type ArenaMapViewportControlsSnapshot,
} from '../mapEngine/map-controller';
import { MapDeveloperTools } from './MapDeveloperTools';
import { MapTopControls } from './MapTopControls';
import {
  useMovementSensors,
} from '../sensors/useMovementSensors';

const rawMapData = require('../storage/map-assets/map.json');

export function MapScreen() {
  const sensorFeed = useMovementSensors(true);
  const [developerToolsExpanded, setDeveloperToolsExpanded] = useState(false);
  const [navigationSnapshot, setNavigationSnapshot] =
    useState<ArenaMapNavigationSnapshot>({
      destinationLabel: 'Node 4',
      remainingDistanceMeters: 0,
      estimatedTimeSeconds: 0,
      estimatedSteps: 0,
      nextStep: 'Route unavailable',
      hasRoute: false,
    });
  const [developerToolsSnapshot, setDeveloperToolsSnapshot] =
    useState<ArenaMapDeveloperToolsSnapshot | null>(null);
  const [viewportControls, setViewportControls] =
    useState<ArenaMapViewportControlsSnapshot | null>(null);

  return (
    <ScreenScaffold>
      <View style={styles.mapCard}>
        {viewportControls ? (
          <View style={styles.topControlsSlot}>
            <MapTopControls
              floorLabel={viewportControls.floorLabel}
              followsBob={viewportControls.followsBob}
              sensorStatus={sensorFeed.status}
              onZoomIn={viewportControls.onZoomIn}
              onZoomOut={viewportControls.onZoomOut}
              onToggleFollowBob={viewportControls.onToggleFollowBob}
            />
          </View>
        ) : null}
        <ArenaMapEngineView
          mapData={rawMapData}
          sensorSamples={sensorFeed.samples}
          latestKnownPedometerSteps={sensorFeed.latestKnownPedometerSteps}
          height={470}
          resetSignal={sensorFeed.resetSignal}
          onNavigationStateChange={setNavigationSnapshot}
          onDeveloperToolsStateChange={setDeveloperToolsSnapshot}
          onViewportControlsStateChange={setViewportControls}
        />
      </View>

      <NavigationSummaryCard
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
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    marginTop: 42,
  },
  topControlsSlot: {
    marginBottom: 8,
  },
});
