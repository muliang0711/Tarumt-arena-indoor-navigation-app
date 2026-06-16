import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../components/theme';
import { ActorLayer, buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorSystem';
import {
  CameraState,
  CameraViewport,
  centerCameraOnPoint,
  createInitialCameraState,
  zoomCamera,
} from './cameran_system/cameranSystem';
import { extractMovementConstraintMapInput } from './mapEngineController';
import { ArenaMapView, getVisualBounds, normalizeMapSchema } from './map_rendering_system/mapRenderingSystem';
import { updateMovementSystem } from './movement_system/indoorposition_engine';
import type { RawSensorSample } from './movement_system/sensor/sensorTypes';

type ArenaMapEngineViewProps = {
  mapData?: unknown;
  sensorSamples?: RawSensorSample[];
  height?: number;
};

const defaultMapData = require('../storage/map-assets/map.json');

export function ArenaMapEngineView({
  mapData: rawMapData = defaultMapData,
  sensorSamples = [],
  height = 390,
}: ArenaMapEngineViewProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [camera, setCamera] = useState<CameraState | null>(null);
  const [isFollowingBob, setIsFollowingBob] = useState(true);
  const mapData = useMemo(() => normalizeMapSchema(rawMapData), [rawMapData]);
  const startingActor = useMemo(() => buildBobActorAtNode(mapData, 'node_1'), [mapData]);
  const constraintMapInput = useMemo(() => extractMovementConstraintMapInput(rawMapData), [rawMapData]);
  const movementUpdate = useMemo(
    () =>
      updateMovementSystem(sensorSamples, constraintMapInput, {
        position: startingActor.position,
        headingRadians: 0,
        confidence: 0.8,
      }),
    [constraintMapInput, sensorSamples, startingActor.position],
  );
  const actors = useMemo(
    () => [
      {
        ...startingActor,
        position: movementUpdate.position,
      },
    ],
    [movementUpdate.position, startingActor],
  );
  const bounds = useMemo(() => getVisualBounds(mapData), [mapData]);
  const viewportSize = useMemo(() => ({ width: Math.max(1, viewportWidth), height }), [height, viewportWidth]);
  const bobPoint = useMemo(
    () => routeNodeToPixels(actors[0], mapData.movement.coordinateSystem.pixelsPerMeter),
    [actors, mapData.movement.coordinateSystem.pixelsPerMeter],
  );
  const initialCamera = useMemo(() => createInitialCameraState(bounds, viewportSize), [bounds, viewportSize]);
  const applyFollowTarget = useCallback(
    (nextCamera: CameraState) => centerCameraOnPoint(nextCamera, bobPoint, viewportSize),
    [bobPoint, viewportSize],
  );

  useEffect(() => {
    if (viewportWidth > 0) {
      const fittedCamera = createInitialCameraState(bounds, viewportSize);
      setCamera(isFollowingBob ? applyFollowTarget(fittedCamera) : fittedCamera);
    }
  }, [applyFollowTarget, bounds, viewportSize, viewportWidth]);

  const renderedCamera = camera ?? (isFollowingBob ? applyFollowTarget(initialCamera) : initialCamera);

  function handleGestureStart() {
    setIsFollowingBob(false);
  }

  function handleCameraChange(nextCamera: CameraState) {
    setCamera(nextCamera);
  }

  function handleZoomButton(factor: number) {
    const focalPoint = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    setCamera((currentCamera) => {
      const zoomedCamera = zoomCamera(currentCamera ?? renderedCamera, factor, undefined, undefined, focalPoint);
      return isFollowingBob ? applyFollowTarget(zoomedCamera) : zoomedCamera;
    });
  }

  function handleToggleFollowBob() {
    setIsFollowingBob((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue) {
        setCamera((currentCamera) => applyFollowTarget(currentCamera ?? renderedCamera));
      }
      return nextValue;
    });
  }

  function handleLayout(event: LayoutChangeEvent) {
    setViewportWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.engine}>
      <CameraViewport
        camera={renderedCamera}
        contentWidth={bounds.width}
        contentHeight={bounds.height}
        height={height}
        onLayout={handleLayout}
        onGestureStart={handleGestureStart}
        onCameraChange={handleCameraChange}
      >
        <ArenaMapView
          mapData={mapData}
          renderOverlay={(layout) => (
            <ActorLayer
              actors={actors}
              layout={layout}
              pixelsPerMeter={mapData.movement.coordinateSystem.pixelsPerMeter}
            />
          )}
        />
      </CameraViewport>

      <View style={styles.cameraControls}>
        <Pressable style={styles.controlButton} onPress={() => handleZoomButton(1.2)}>
          <Text style={styles.controlButtonText}>+</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={() => handleZoomButton(1 / 1.2)}>
          <Text style={styles.controlButtonText}>-</Text>
        </Pressable>
        <Pressable
          style={[styles.followButton, isFollowingBob && styles.followButtonActive]}
          onPress={handleToggleFollowBob}
        >
          <Text style={[styles.followButtonText, isFollowingBob && styles.followButtonTextActive]}>
            {isFollowingBob ? 'Following Bob' : 'Free look'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  engine: {
    position: 'relative',
  },
  cameraControls: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  controlButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  followButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  followButtonActive: {
    backgroundColor: colors.green,
  },
  followButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  followButtonTextActive: {
    color: '#ffffff',
  },
});
