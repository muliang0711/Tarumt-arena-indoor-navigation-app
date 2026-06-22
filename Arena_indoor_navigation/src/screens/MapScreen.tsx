import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Header } from '../components/Header';
import { MapRouteInstructionCard } from '../components/MapRouteInstructionCard';
import { MapTripSummaryCard } from '../components/MapTripSummaryCard';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SearchBar } from '../components/SearchBar';
import { colors, radius, shadow } from '../components/theme';
import { ArenaMapEngineView } from '../mapEngine/map-controller';
import {
  MovementSensorDevPanel,
  useMovementSensors,
} from '../sensors/useMovementSensors';

const rawMapData = require('../storage/map-assets/map.json');

export function MapScreen() {
  const sensorFeed = useMovementSensors(true);
  const window = useWindowDimensions();
  const mapViewportHeight = Math.max(
    235,
    Math.min(450, Math.round(window.height - 445)),
  );

  return (
    <ScreenScaffold scroll={false}>
      <View style={styles.page}>
        <Header compact title="Indoor Map" subtitle="Level 2 navigation" />
        <SearchBar compact placeholder="Search on map..." />

        <View style={[styles.mapViewport, { height: mapViewportHeight }]}>
          <ArenaMapEngineView
            mapData={rawMapData}
            sensorSamples={sensorFeed.samples}
            latestKnownPedometerSteps={sensorFeed.latestKnownPedometerSteps}
            height={mapViewportHeight}
            resetSignal={sensorFeed.resetSignal}
            showMovementDiagnostics={false}
          />

          <View style={styles.floorControl}>
            <Ionicons name="layers" size={17} color={colors.text} />
            <Text style={styles.floorText}>Floor 1</Text>
            <Ionicons name="chevron-down" size={16} color={colors.text} />
          </View>

          <View style={styles.routeOverlay}>
            <MapRouteInstructionCard />
          </View>
        </View>

        <MapTripSummaryCard />
        <MovementSensorDevPanel controls={sensorFeed.developmentControls} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 8,
  },
  mapViewport: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: '#ede5d8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...shadow,
  },
  floorControl: {
    position: 'absolute',
    zIndex: 40,
    top: 12,
    left: 12,
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,253,249,0.96)',
    ...shadow,
  },
  floorText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  routeOverlay: {
    position: 'absolute',
    zIndex: 35,
    top: 62,
    left: 12,
    width: '58%',
    maxWidth: 245,
  },
});
