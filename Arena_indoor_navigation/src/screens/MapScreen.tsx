import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Header } from '../components/Header';
import { MapRouteInstructionCard } from '../components/MapRouteInstructionCard';
import { MapTripSummaryCard } from '../components/MapTripSummaryCard';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SearchBar } from '../components/SearchBar';
import { colors, radius, shadow } from '../components/theme';
import {
  ArenaMapEngineView,
  type ArenaMapEngineHandle,
} from '../mapEngine/map-controller';
import {
  MovementSensorDevPanel,
  useMovementSensors,
} from '../sensors/useMovementSensors';

const rawMapData = require('../storage/map-assets/map.json');

export function MapScreen() {
  const sensorFeed = useMovementSensors(true);
  const mapEngineRef = useRef<ArenaMapEngineHandle>(null);
  const [mapViewportHeight, setMapViewportHeight] = useState(1);
  const [followsActor, setFollowsActor] = useState(true);

  function handleMapLayout(event: LayoutChangeEvent) {
    const height = Math.max(1, Math.round(event.nativeEvent.layout.height));
    setMapViewportHeight((current) => (current === height ? current : height));
  }

  return (
    <ScreenScaffold scroll={false}>
      <View style={styles.page}>
        <Header compact title="Indoor Map" subtitle="Level 2 navigation" />
        <SearchBar compact placeholder="Search on map..." />

        <View style={styles.mapArea}>
          <View style={styles.mapViewport} onLayout={handleMapLayout}>
            <ArenaMapEngineView
              ref={mapEngineRef}
              mapData={rawMapData}
              sensorSamples={sensorFeed.samples}
              latestKnownPedometerSteps={sensorFeed.latestKnownPedometerSteps}
              height={mapViewportHeight}
              resetSignal={sensorFeed.resetSignal}
              showMovementDiagnostics={false}
              onFollowStateChange={setFollowsActor}
            />

            <View style={styles.mapControlsOverlay} pointerEvents="box-none">
              <View style={styles.floorControl}>
                <Ionicons name="layers" size={17} color={colors.text} />
                <Text style={styles.floorText}>Floor 1</Text>
                <Ionicons name="chevron-down" size={16} color={colors.text} />
              </View>

              <View style={styles.cameraControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                  style={styles.zoomButton}
                  onPress={() => mapEngineRef.current?.zoomIn()}
                >
                  <Text style={styles.zoomText}>+</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                  style={styles.zoomButton}
                  onPress={() => mapEngineRef.current?.zoomOut()}
                >
                  <Text style={styles.zoomText}>−</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={[
                    styles.followButton,
                    followsActor && styles.followButtonActive,
                  ]}
                  onPress={() => mapEngineRef.current?.recenter()}
                >
                  <Text
                    style={[
                      styles.followText,
                      followsActor && styles.followTextActive,
                    ]}
                  >
                    {followsActor ? 'Following Bob' : 'Recenter'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.routeOverlay} pointerEvents="none">
              <MapRouteInstructionCard />
            </View>
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
    minHeight: 0,
    gap: 8,
    overflow: 'hidden',
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
  mapControlsOverlay: {
    position: 'absolute',
    zIndex: 50,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floorControl: {
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
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  zoomButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,253,249,0.97)',
    ...shadow,
  },
  zoomText: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 23,
  },
  followButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,253,249,0.97)',
    ...shadow,
  },
  followButtonActive: {
    backgroundColor: colors.green,
  },
  followText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  followTextActive: {
    color: '#ffffff',
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
