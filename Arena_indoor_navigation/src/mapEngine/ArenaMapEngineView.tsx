import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import {
  ActorLayer,
  buildBobActorAtNode,
  deriveActorMotionState,
  routeNodeToPixels,
} from './actor_system/actorSystem';
import {
  CameraViewport,
  centerCameraOnPoint,
  constrainCameraToBounds,
  createActorCameraState,
  enterManualPan,
  isFollowingActor,
  recenterActor,
  zoomCamera,
  type CameraMode,
  type CameraState,
} from './cameran_system/cameranSystem';
import {
  buildMovementDebugSnapshot,
  DestinationDebugLayer,
  extractTemporaryWalkableAreas,
  findDestinationNode,
  MovementDebugPanel,
  sendMovementDebugLog,
  WalkableAreaDebugLayer,
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
  showMovementDiagnostics?: boolean;
  onFollowStateChange?: (following: boolean) => void;
};

export type ArenaMapEngineHandle = {
  zoomIn(): void;
  zoomOut(): void;
  recenter(): void;
};

const defaultMapData = require('../storage/map-assets/map.json');
const EMPTY_SENSOR_SAMPLES: readonly RawSensorSample[] = Object.freeze([]);

export const ArenaMapEngineView = forwardRef<
  ArenaMapEngineHandle,
  ArenaMapEngineViewProps
>(function ArenaMapEngineView(
  {
    mapData: rawMapData = defaultMapData,
    sensorSamples = EMPTY_SENSOR_SAMPLES,
    latestKnownPedometerSteps = null,
    startingNodeId = 'node_1',
    height = 390,
    resetSignal = 0,
    showMovementDiagnostics = true,
    onFollowStateChange,
  },
  ref,
) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [camera, setCamera] = useState<CameraState | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('followActor');
  const followsBob = isFollowingActor(cameraMode);
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
  const [actorHeadingRadians, setActorHeadingRadians] = useState(startingActor.headingRadians);
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
  const lastLoggedBatchSignatureRef = useRef<string | null>(null);

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
      setActorHeadingRadians(startingActor.headingRadians);
      setBobMotionState({
        direction: startingActor.direction,
        action: 'idle',
      });
      setPedometerBaselineSteps(baselineSteps);
      setProcessingStatus(status);
    },
    [startingActor.direction, startingActor.headingRadians, startingActor.position],
  );

  useEffect(() => {
    applyNavigationReset(
      'waiting',
      sensorSamplesRef.current,
      latestKnownPedometerStepsRef.current,
    );
  }, [applyNavigationReset, mapData, startingActor.position, startingNodeId]);

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
      setActorHeadingRadians(movementUpdate.headingRadians);
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
        headingRadians: actorHeadingRadians,
        direction: bobMotionState.direction,
        action: bobMotionState.action,
      },
    ],
    [actorHeadingRadians, actorPosition, bobMotionState.action, bobMotionState.direction, startingActor],
  );
  const bounds = useMemo(() => getVisualBounds(mapData), [mapData]);
  const viewportSize = useMemo(() => ({ width: Math.max(1, viewportWidth), height }), [height, viewportWidth]);
  const bobPoint = useMemo(
    () => {
      const absolutePoint = routeNodeToPixels(actors[0], mapData.coordinateSystem);
      return {
        x: absolutePoint.x - bounds.x,
        y: absolutePoint.y - bounds.y,
      };
    },
    [actors, bounds.x, bounds.y, mapData.coordinateSystem],
  );
  const sceneBounds = useMemo(
    () => ({ x: 0, y: 0, width: bounds.width, height: bounds.height }),
    [bounds.height, bounds.width],
  );
  const initialCamera = useMemo(
    () => createActorCameraState(sceneBounds, viewportSize, bobPoint),
    [bobPoint, sceneBounds, viewportSize],
  );
  const applyFollowTarget = useCallback(
    (nextCamera: CameraState) =>
      constrainCameraToBounds(
        centerCameraOnPoint(nextCamera, bobPoint, viewportSize),
        sceneBounds,
        viewportSize,
      ),
    [bobPoint, sceneBounds, viewportSize],
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
    if (sensorSamples.length === 0 || debugSnapshot.latestTimestamp === null) {
      return;
    }

    const batchSignature = sensorSamples
      .map((sample) => `${sample.id ?? sample.kind}:${sample.timestamp}`)
      .join('|');
    if (batchSignature.length === 0 || batchSignature === lastLoggedBatchSignatureRef.current) {
      return;
    }

    lastLoggedBatchSignatureRef.current = batchSignature;
    void sendMovementDebugLog(debugSnapshot, latestKnownPedometerSteps);
  }, [debugSnapshot, latestKnownPedometerSteps, sensorSamples]);

  useEffect(() => {
    if (viewportWidth > 0) {
      setCamera(initialCamera);
    }
  }, [initialCamera, viewportWidth]);

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

  useEffect(() => {
    onFollowStateChange?.(followsBob);
  }, [followsBob, onFollowStateChange]);

  const renderedCamera = camera ?? (followsBob ? applyFollowTarget(initialCamera) : initialCamera);

  function handleCameraChange(nextCamera: CameraState) {
    setCamera(constrainCameraToBounds(nextCamera, sceneBounds, viewportSize));
  }

  function handleCameraInteractionStart() {
    setCameraMode(enterManualPan);
  }

  function handleZoomButton(factor: number) {
    const focalPoint = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    setCamera((currentCamera) => {
      const zoomedCamera = zoomCamera(currentCamera ?? renderedCamera, factor, undefined, undefined, focalPoint);
      return followsBob
        ? applyFollowTarget(zoomedCamera)
        : constrainCameraToBounds(zoomedCamera, sceneBounds, viewportSize);
    });
  }

  function handleRecenterActor() {
    setCameraMode(recenterActor);
    setCamera((currentCamera) => applyFollowTarget(currentCamera ?? renderedCamera));
  }

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => handleZoomButton(1.2),
      zoomOut: () => handleZoomButton(1 / 1.2),
      recenter: handleRecenterActor,
    }),
  );

  function handleResetNavigation() {
    applyNavigationReset('reset', sensorSamples, latestKnownPedometerSteps);
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
        viewportWidth={viewportSize.width}
        height={height}
        onLayout={handleLayout}
        onCameraChange={handleCameraChange}
        onInteractionStart={handleCameraInteractionStart}
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

      {showMovementDiagnostics ? (
        <MovementDebugPanel
          snapshot={debugSnapshot}
          onReset={handleResetNavigation}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  engine: {
    position: 'relative',
  },
});
