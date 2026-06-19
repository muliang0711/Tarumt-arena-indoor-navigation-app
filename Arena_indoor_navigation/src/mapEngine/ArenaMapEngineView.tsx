import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../components/theme';
import {
  ActorLayer,
  buildBobActorAtNode,
  deriveActorMotionState,
  routeNodeToPixels,
} from './actor_system/actorSystem';
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
  buildUnwalkableOverlayModel,
  calculateNavigationRoute,
  clearNavigationRoute,
  createNavigationDebugState,
  extractTemporaryWalkableAreas,
  findDestinationNode,
  getSelectableDestinations,
  MovementDebugPanel,
  NavigationDebugPanel,
  NavigationNodeLayer,
  RouteDebugLayer,
  selectNavigationDestination,
  toggleUnwalkableOverlay,
  UnwalkableAreaDebugLayer,
  WalkableAreaDebugLayer,
  type NavigationDestinationId,
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
  latestKnownPedometerSteps?: number | null;
  startingNodeId?: string;
  height?: number;
  resetSignal?: number;
};

const defaultMapData = require('../storage/map-assets/map.json');
const EMPTY_SENSOR_SAMPLES: readonly RawSensorSample[] = Object.freeze([]);

export function ArenaMapEngineView({
  mapData: rawMapData = defaultMapData,
  sensorSamples = EMPTY_SENSOR_SAMPLES,
  latestKnownPedometerSteps = null,
  startingNodeId = 'node_1',
  height = 390,
  resetSignal = 0,
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
  const [navigationState, setNavigationState] = useState(() =>
    createNavigationDebugState(startingActor.nodeId, mapData.movement.routeGraph),
  );
  const destinationNodeId = navigationState.selectedDestinationId;
  const originNode = useMemo(
    () => findDestinationNode(mapData.movement.routeGraph, navigationState.originNodeId),
    [mapData.movement.routeGraph, navigationState.originNodeId],
  );
  const destinationNode = useMemo(
    () => findDestinationNode(mapData.movement.routeGraph, destinationNodeId),
    [destinationNodeId, mapData.movement.routeGraph],
  );
  const selectableDestinations = useMemo(
    () => getSelectableDestinations(mapData.movement.routeGraph),
    [mapData.movement.routeGraph],
  );
  const walkableAreas = useMemo(
    () => extractTemporaryWalkableAreas(mapData.visualLayers, mapData.coordinateSystem),
    [mapData.coordinateSystem, mapData.visualLayers],
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
  const previousActorPositionRef = useRef(startingActor.position);
  const [pedometerBaselineSteps, setPedometerBaselineSteps] = useState<number | null>(
    latestKnownPedometerSteps,
  );
  const lastHandledResetSignalRef = useRef(resetSignal);
  const latestKnownPedometerStepsRef = useRef(latestKnownPedometerSteps);
  const sensorSamplesRef = useRef(sensorSamples);
  const [bobMotionState, setBobMotionState] = useState({
    direction: startingActor.direction,
    action: startingActor.action,
  });

  useEffect(() => {
    latestKnownPedometerStepsRef.current = latestKnownPedometerSteps;
  }, [latestKnownPedometerSteps]);

  useEffect(() => {
    sensorSamplesRef.current = sensorSamples;
  }, [sensorSamples]);

  const applyNavigationReset = useCallback(
    (
      status: MovementProcessingStatus,
      resetSamples: readonly RawSensorSample[],
      baselineSteps: number | null,
    ) => {
      movementRuntimeRef.current?.reset(startingActor.position, {
        samplesToIgnore: resetSamples,
        previousStepCount: baselineSteps ?? undefined,
      });
      previousActorPositionRef.current = startingActor.position;
      setActorPosition(startingActor.position);
      setBobMotionState({
        direction: startingActor.direction,
        action: 'idle',
      });
      setPedometerBaselineSteps(baselineSteps);
      setProcessingStatus(status);
    },
    [startingActor.direction, startingActor.position],
  );

  useEffect(() => {
    applyNavigationReset(
      'waiting',
      sensorSamplesRef.current,
      latestKnownPedometerStepsRef.current,
    );
  }, [applyNavigationReset, mapData, startingActor.position, startingNodeId]);

  useEffect(() => {
    setNavigationState(
      createNavigationDebugState(startingActor.nodeId, mapData.movement.routeGraph),
    );
  }, [mapData.movement.routeGraph, startingActor.nodeId]);

  useEffect(() => {
    if (pedometerBaselineSteps === null && latestKnownPedometerSteps !== null) {
      setPedometerBaselineSteps(latestKnownPedometerSteps);
    }
  }, [latestKnownPedometerSteps, pedometerBaselineSteps]);

  useEffect(() => {
    if (resetSignal === lastHandledResetSignalRef.current) {
      return;
    }
    lastHandledResetSignalRef.current = resetSignal;
    applyNavigationReset('reset', sensorSamples, latestKnownPedometerSteps);
  }, [applyNavigationReset, latestKnownPedometerSteps, resetSignal, sensorSamples]);

  useEffect(() => {
    const movementUpdate = movementRuntimeRef.current?.process(sensorSamples, constraintMapInput);
    if (movementUpdate) {
      const nextPosition = movementUpdate.position;
      setBobMotionState(
        deriveActorMotionState(startingActor, {
          x: nextPosition.x - previousActorPositionRef.current.x,
          y: nextPosition.y - previousActorPositionRef.current.y,
        }),
      );
      previousActorPositionRef.current = nextPosition;
      setActorPosition(movementUpdate.position);
      setProcessingStatus('processed');
      return;
    }
    setBobMotionState((currentMotionState) => ({
      direction: currentMotionState.direction,
      action: 'idle',
    }));
    setProcessingStatus(sensorSamples.length > 0 ? 'ignored' : 'waiting');
  }, [constraintMapInput, sensorSamples]);

  const actors = useMemo(
    () => [
      {
        ...startingActor,
        position: actorPosition,
        direction: bobMotionState.direction,
        action: bobMotionState.action,
      },
    ],
    [actorPosition, bobMotionState.action, bobMotionState.direction, startingActor],
  );
  const bounds = useMemo(() => getVisualBounds(mapData), [mapData]);
  const unwalkableOverlay = useMemo(
    () =>
      buildUnwalkableOverlayModel(constraintMapInput, {
        x: bounds.x / mapData.coordinateSystem.pixelsPerMeter,
        y: bounds.y / mapData.coordinateSystem.pixelsPerMeter,
        width: bounds.width / mapData.coordinateSystem.pixelsPerMeter,
        height: bounds.height / mapData.coordinateSystem.pixelsPerMeter,
      }),
    [bounds, constraintMapInput, mapData.coordinateSystem.pixelsPerMeter],
  );
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
        pedometer: {
          latestKnownSteps: latestKnownPedometerSteps,
          baselineSteps: pedometerBaselineSteps,
        },
      }),
    [
      actorPosition,
      destinationNode,
      destinationNodeId,
      latestKnownPedometerSteps,
      pedometerBaselineSteps,
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
    applyNavigationReset('reset', sensorSamples, latestKnownPedometerSteps);
  }

  function handleSelectDestination(destination: NavigationDestinationId) {
    setNavigationState((currentState) =>
      selectNavigationDestination(
        currentState,
        destination,
        mapData.movement.routeGraph,
      ),
    );
  }

  function handleCalculateRoute() {
    setNavigationState((currentState) =>
      calculateNavigationRoute(currentState, mapData.movement.routeGraph),
    );
  }

  function handleClearRoute() {
    setNavigationState(clearNavigationRoute);
  }

  function handleToggleUnwalkable() {
    setNavigationState(toggleUnwalkableOverlay);
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
              <WalkableAreaDebugLayer
                areas={walkableAreas}
                bounds={layout.bounds}
                coordinateSystem={mapData.coordinateSystem}
              />
              {navigationState.showUnwalkableOverlay ? (
                <UnwalkableAreaDebugLayer
                  model={unwalkableOverlay}
                  bounds={layout.bounds}
                  coordinateSystem={mapData.coordinateSystem}
                />
              ) : null}
              <RouteDebugLayer
                route={navigationState.highlightedPath}
                routeGraph={mapData.movement.routeGraph}
                bounds={layout.bounds}
                coordinateSystem={mapData.coordinateSystem}
              />
              <NavigationNodeLayer
                origin={originNode}
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
      <NavigationDebugPanel
        state={navigationState}
        destinations={selectableDestinations}
        onSelectDestination={handleSelectDestination}
        onCalculateRoute={handleCalculateRoute}
        onClearRoute={handleClearRoute}
        onToggleUnwalkable={handleToggleUnwalkable}
      />
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
