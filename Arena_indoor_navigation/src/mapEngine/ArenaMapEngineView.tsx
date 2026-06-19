import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../components/theme';
import { ActorLayer, buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorSystem';
import {
  CameraViewport,
  centerCameraOnPoint,
  createInitialCameraState,
  isFollowingBob,
  toggleCameraFollowMode,
  zoomCamera,
  type CameraFollowMode,
  type CameraState,
} from './cameran_system/cameranSystem';
import {
  buildMovementDebugSnapshot,
  DestinationDebugLayer,
  findDestinationNode,
  MovementDebugPanel,
  type MovementProcessingStatus,
} from './debugger';
import { extractMovementConstraintMapInput } from './mapEngineController';
import { ArenaMapView, getVisualBounds, normalizeMapSchema } from './map_rendering_system/mapRenderingSystem';
import {
  MovementRuntime,
  updateMovementSystem,
  type RawSensorSample,
} from './movement_system';
import { extractMapCoordinateSystem } from './shared';

type ArenaMapEngineViewProps = {
  mapData?: unknown;
  sensorSamples?: readonly RawSensorSample[];
  startingNodeId?: string;
  height?: number;
};

const defaultMapData = require('../storage/map-assets/map.json');
const EMPTY_SENSOR_SAMPLES: readonly RawSensorSample[] = Object.freeze([]);

export function ArenaMapEngineView({
  mapData: rawMapData = defaultMapData,
  sensorSamples = EMPTY_SENSOR_SAMPLES,
  startingNodeId = 'node_1',
  height = 390,
}: ArenaMapEngineViewProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [camera, setCamera] = useState<CameraState | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraFollowMode>('following');
  const followsBob = isFollowingBob(cameraMode);
  const coordinateSystem = useMemo(
    () => extractMapCoordinateSystem(rawMapData),
    [rawMapData],
  );
  const mapData = useMemo(
    () => normalizeMapSchema(rawMapData, coordinateSystem),
    [coordinateSystem, rawMapData],
  );
  const startingActor = useMemo(
    () => buildBobActorAtNode(mapData, startingNodeId),
    [mapData, startingNodeId],
  );
  const destinationNodeId = 'node_4';
  const destinationNode = useMemo(
    () => findDestinationNode(mapData.movement.routeGraph, destinationNodeId),
    [destinationNodeId, mapData.movement.routeGraph],
  );
  const [processingStatus, setProcessingStatus] =
    useState<MovementProcessingStatus>('waiting');
  const constraintMapInput = useMemo(
    () => extractMovementConstraintMapInput(rawMapData, coordinateSystem),
    [coordinateSystem, rawMapData],
  );
  const movementRuntimeRef = useRef<MovementRuntime | null>(null);
  if (movementRuntimeRef.current === null) {
    movementRuntimeRef.current = new MovementRuntime(startingActor.position, updateMovementSystem);
  }
  const [actorPosition, setActorPosition] = useState(startingActor.position);

  useEffect(() => {
    movementRuntimeRef.current?.reset(startingActor.position, sensorSamples);
    setActorPosition(startingActor.position);
    setProcessingStatus('waiting');
  }, [mapData, startingActor.position, startingNodeId]);

  useEffect(() => {
    const movementUpdate = movementRuntimeRef.current?.process(sensorSamples, constraintMapInput);
    if (movementUpdate) {
      setActorPosition(movementUpdate.position);
      setProcessingStatus('processed');
      return;
    }
    setProcessingStatus(sensorSamples.length > 0 ? 'ignored' : 'waiting');
  }, [constraintMapInput, sensorSamples]);

  const actors = useMemo(
    () => [
      {
        ...startingActor,
        position: actorPosition,
      },
    ],
    [actorPosition, startingActor],
  );
  const bounds = useMemo(() => getVisualBounds(mapData), [mapData]);
  const viewportSize = useMemo(() => ({ width: Math.max(1, viewportWidth), height }), [height, viewportWidth]);
  const bobPoint = useMemo(
    () => routeNodeToPixels(actors[0], mapData.coordinateSystem),
    [actors, mapData.coordinateSystem],
  );
  const initialCamera = useMemo(() => createInitialCameraState(bounds, viewportSize), [bounds, viewportSize]);
  const applyFollowTarget = useCallback(
    (nextCamera: CameraState) => centerCameraOnPoint(nextCamera, bobPoint, viewportSize),
    [bobPoint, viewportSize],
  );
  const debugSnapshot = useMemo(
    () =>
      buildMovementDebugSnapshot({
        samples: sensorSamples,
        state: movementRuntimeRef.current?.getState() ?? {
          position: actorPosition,
          headingRadians: 0,
          confidence: 0.8,
        },
        status: processingStatus,
        destinationNodeId,
        destinationAvailable: destinationNode !== null,
      }),
    [
      actorPosition,
      destinationNode,
      destinationNodeId,
      processingStatus,
      sensorSamples,
    ],
  );

  useEffect(() => {
    if (viewportWidth > 0) {
      setCamera(createInitialCameraState(bounds, viewportSize));
    }
  }, [bounds, viewportSize, viewportWidth]);

  useEffect(() => {
    if (!followsBob || viewportWidth <= 0) {
      return;
    }
    setCamera((currentCamera) => applyFollowTarget(currentCamera ?? initialCamera));
  }, [
    applyFollowTarget,
    followsBob,
    initialCamera,
    viewportWidth,
  ]);

  const renderedCamera = camera ?? (followsBob ? applyFollowTarget(initialCamera) : initialCamera);

  function handleCameraChange(nextCamera: CameraState) {
    setCamera(nextCamera);
  }

  function handleZoomButton(factor: number) {
    const focalPoint = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    setCamera((currentCamera) => {
      const zoomedCamera = zoomCamera(currentCamera ?? renderedCamera, factor, undefined, undefined, focalPoint);
      return followsBob ? applyFollowTarget(zoomedCamera) : zoomedCamera;
    });
  }

  function handleToggleFollowBob() {
    setCameraMode((currentMode) => {
      const nextMode = toggleCameraFollowMode(currentMode);
      if (isFollowingBob(nextMode)) {
        setCamera((currentCamera) => applyFollowTarget(currentCamera ?? renderedCamera));
      }
      return nextMode;
    });
  }

  function handleResetNavigation() {
    movementRuntimeRef.current?.reset(startingActor.position, sensorSamples);
    setActorPosition(startingActor.position);
    setProcessingStatus('reset');
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
        onCameraChange={handleCameraChange}
      >
        <ArenaMapView
          mapData={mapData}
          renderOverlay={(layout) => (
            <>
              <DestinationDebugLayer
                destination={destinationNode}
                bounds={layout.bounds}
                coordinateSystem={mapData.coordinateSystem}
              />
              <ActorLayer
                actors={actors}
                layout={layout}
                coordinateSystem={mapData.coordinateSystem}
              />
            </>
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
          style={[styles.followButton, followsBob && styles.followButtonActive]}
          onPress={handleToggleFollowBob}
        >
          <Text style={[styles.followButtonText, followsBob && styles.followButtonTextActive]}>
            {followsBob ? 'Following Bob' : 'Free look'}
          </Text>
        </Pressable>
      </View>
      <MovementDebugPanel
        snapshot={debugSnapshot}
        onReset={handleResetNavigation}
      />
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
