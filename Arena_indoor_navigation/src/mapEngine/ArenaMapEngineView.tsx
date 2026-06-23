import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  ActorLayer,
  appendActorMovementTargets,
  buildBobActorAtNode,
  consumeActorMovementTarget,
  createActorMovementQueue,
  deriveActorDirectionFromHeading,
  deriveActorMotionState,
  routeNodeToPixels,
  shortestHeadingDelta,
  shouldContinueActorSmoothing,
  stepActorRenderPosition,
  stepHeadingToward,
  type ActorDirection,
  type ActorMovementTarget,
} from './actor_system/actorSystem';
import {
  CameraViewport,
  centerCameraOnPoint,
  constrainCameraToBounds,
  enterManualPan,
  isFollowingActor,
  recenterActor,
  setCameraZoom,
  zoomCamera,
  type CameraMode,
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
  sendMovementDebugLog,
  toggleUnwalkableOverlay,
  UnwalkableAreaDebugLayer,
  WalkableAreaDebugLayer,
  type NavigationDestinationId,
  type MovementProcessingStatus,
} from './debugger';
import {
  buildNavigationGuidance,
  buildRoutePolyline,
  type NavigationCue,
} from './navigation_guidance';
import { extractMovementConstraintMapInput } from './mapEngineController';
import {
  ArenaMapView,
  getVisualBounds,
  normalizeMapSchema,
} from './map_rendering_system/mapRenderingSystem';
import {
  MovementRuntime,
  updateMovementSystem,
  type RawSensorSample,
} from './movement_system';
import { extractMapCoordinateSystem } from './shared';

export type ArenaMapNavigationSnapshot = {
  destinationLabel: string;
  remainingDistanceMeters: number;
  estimatedTimeSeconds: number;
  estimatedSteps: number;
  nextStep: string;
  cue: NavigationCue | null;
  nextCue: NavigationCue | null;
  hasRoute: boolean;
};

export type ArenaMapDeveloperToolsSnapshot = {
  debugSnapshot: Parameters<typeof MovementDebugPanel>[0]['snapshot'];
  navigationState: Parameters<typeof NavigationDebugPanel>[0]['state'];
  selectableDestinations: readonly {
    nodeId: NavigationDestinationId;
    available: boolean;
  }[];
  onSelectDestination: (destination: NavigationDestinationId) => void;
  onCalculateRoute: () => void;
  onClearRoute: () => void;
  onToggleUnwalkable: () => void;
  onResetNavigation: () => void;
};

export type ArenaMapViewportControlsSnapshot = {
  floorLabel: string;
  followsBob: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFollowBob: () => void;
  onRecenter: () => void;
};

type ArenaMapEngineViewProps = {
  mapData?: unknown;
  sensorSamples?: readonly RawSensorSample[];
  latestKnownPedometerSteps?: number | null;
  startingNodeId?: string;
  height?: number;
  resetSignal?: number;
  onNavigationStateChange?: (snapshot: ArenaMapNavigationSnapshot) => void;
  onDeveloperToolsStateChange?: (snapshot: ArenaMapDeveloperToolsSnapshot | null) => void;
  onViewportControlsStateChange?: (snapshot: ArenaMapViewportControlsSnapshot | null) => void;
};

const defaultMapData = require('../storage/map-assets/map.json');
const EMPTY_SENSOR_SAMPLES: readonly RawSensorSample[] = Object.freeze([]);
const ACTOR_RENDER_SPEED_METERS_PER_SECOND = 2.8;
const HEADING_RENDER_SPEED_RADIANS_PER_SECOND = Math.PI * 4;
const DEFAULT_STEP_LENGTH_METERS = 0.7;
const FOLLOW_VISIBLE_HEIGHT_METERS = 9.5;
const FOLLOW_VISIBLE_WIDTH_METERS = 8;
const FREE_LOOK_VISIBLE_HEIGHT_METERS = 13;
const FREE_LOOK_VISIBLE_WIDTH_METERS = 11;

function directionToHeadingRadians(direction: ActorDirection): number {
  switch (direction) {
    case 'up':
      return -Math.PI / 2;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    default:
      return 0;
  }
}

function destinationLabelFor(nodeId: string): string {
  return nodeId.replace(/^node_/, 'Node ');
}

function createNavigationViewportCamera(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
  pixelsPerMeter: number,
  visibleWidthMeters: number,
  visibleHeightMeters: number,
): CameraState {
  const widthScale = viewport.width / Math.max(1, visibleWidthMeters * pixelsPerMeter);
  const heightScale = viewport.height / Math.max(1, visibleHeightMeters * pixelsPerMeter);
  const scale = Math.max(0.9, Math.min(4, Math.max(widthScale, heightScale)));

  return centerCameraOnPoint(
    {
      scale,
      offsetX: 0,
      offsetY: 0,
    },
    point,
    viewport,
  );
}

export function ArenaMapEngineView({
  mapData: rawMapData = defaultMapData,
  sensorSamples = EMPTY_SENSOR_SAMPLES,
  latestKnownPedometerSteps = null,
  startingNodeId = 'node_1',
  height = 390,
  resetSignal = 0,
  onNavigationStateChange,
  onDeveloperToolsStateChange,
  onViewportControlsStateChange,
}: ArenaMapEngineViewProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [camera, setCamera] = useState<CameraState | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('followActor');
  const viewportControlHandlersRef = useRef({
    zoomIn: () => {},
    zoomOut: () => {},
    toggleFollow: () => {},
    recenter: () => {},
  });
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
  const [displayActorPosition, setDisplayActorPosition] = useState(startingActor.position);
  const [renderTargetPosition, setRenderTargetPosition] = useState(startingActor.position);
  const displayActorPositionRef = useRef(startingActor.position);
  const logicalActorPositionRef = useRef(startingActor.position);
  const previousPositionRef = useRef(startingActor.position);
  const smoothingFrameRef = useRef<number | null>(null);
  const smoothingTimestampRef = useRef<number | null>(null);
  const movementQueueRef = useRef(createActorMovementQueue());
  const activeMovementTargetRef = useRef<ActorMovementTarget | null>(null);
  const activeMovementSpeedRef = useRef(ACTOR_RENDER_SPEED_METERS_PER_SECOND);
  const lastPedometerEventTimestampRef = useRef<number | null>(null);
  const [latestAcceptedStepPositionCount, setLatestAcceptedStepPositionCount] =
    useState(0);
  const [displayHeadingRadians, setDisplayHeadingRadians] = useState(0);
  const displayHeadingRef = useRef(0);
  const headingFrameRef = useRef<number | null>(null);
  const headingTimestampRef = useRef<number | null>(null);
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

  useEffect(() => {
    logicalActorPositionRef.current = actorPosition;
  }, [actorPosition]);

  useEffect(() => {
    displayActorPositionRef.current = displayActorPosition;
  }, [displayActorPosition]);

  const stopActorSmoothing = useCallback(() => {
    if (smoothingFrameRef.current !== null) {
      cancelAnimationFrame(smoothingFrameRef.current);
      smoothingFrameRef.current = null;
    }
    smoothingTimestampRef.current = null;
  }, []);

  const stopHeadingSmoothing = useCallback(() => {
    if (headingFrameRef.current !== null) {
      cancelAnimationFrame(headingFrameRef.current);
      headingFrameRef.current = null;
    }
    headingTimestampRef.current = null;
  }, []);

  const activateNextMovementTarget = useCallback(() => {
    const consumed = consumeActorMovementTarget(movementQueueRef.current);
    movementQueueRef.current = consumed.queue;
    activeMovementTargetRef.current = consumed.target;
    if (!consumed.target) {
      return false;
    }

    const currentPosition = displayActorPositionRef.current;
    const distanceMeters = Math.hypot(
      consumed.target.position.x - currentPosition.x,
      consumed.target.position.y - currentPosition.y,
    );
    activeMovementSpeedRef.current =
      distanceMeters > 0
        ? distanceMeters / Math.max(0.001, consumed.target.durationMs / 1000)
        : ACTOR_RENDER_SPEED_METERS_PER_SECOND;
    setRenderTargetPosition(consumed.target.position);
    return true;
  }, []);

  const applyNavigationReset = useCallback(
    (
      status: MovementProcessingStatus,
      resetSamples: readonly RawSensorSample[],
      baselineSteps: number | null,
    ) => {
      stopActorSmoothing();
      stopHeadingSmoothing();
      movementRuntimeRef.current?.reset(startingActor.position, {
        samplesToIgnore: resetSamples,
        previousStepCount: baselineSteps ?? undefined,
      });
      logicalActorPositionRef.current = startingActor.position;
      displayActorPositionRef.current = startingActor.position;
      previousPositionRef.current = startingActor.position;
      movementQueueRef.current = createActorMovementQueue();
      activeMovementTargetRef.current = null;
      activeMovementSpeedRef.current = ACTOR_RENDER_SPEED_METERS_PER_SECOND;
      lastPedometerEventTimestampRef.current = null;
      displayHeadingRef.current = 0;
      setActorPosition(startingActor.position);
      setDisplayActorPosition(startingActor.position);
      setRenderTargetPosition(startingActor.position);
      setDisplayHeadingRadians(0);
      setLatestAcceptedStepPositionCount(0);
      setBobMotionState({
        direction: startingActor.direction,
        action: 'idle',
      });
      setPedometerBaselineSteps(baselineSteps);
      setProcessingStatus(status);
    },
    [
      startingActor.direction,
      startingActor.position,
      stopActorSmoothing,
      stopHeadingSmoothing,
    ],
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
      logicalActorPositionRef.current = movementUpdate.position;
      // A heading-only batch keeps the same logical position object. Copy it so
      // React still re-renders the live heading update.
      setActorPosition({ ...movementUpdate.position });
      setLatestAcceptedStepPositionCount(
        movementUpdate.acceptedStepPositions.length,
      );

      const latestPedometer = sensorSamples
        .filter(
          (
            sample,
          ): sample is Extract<RawSensorSample, { kind: 'pedometer' }> =>
            sample.kind === 'pedometer',
        )
        .sort((left, right) => left.timestamp - right.timestamp)
        .at(-1);
      const previousEventTimestamp = lastPedometerEventTimestampRef.current;
      const eventIntervalMs =
        latestPedometer && previousEventTimestamp !== null
          ? latestPedometer.timestamp - previousEventTimestamp
          : null;
      if (latestPedometer) {
        lastPedometerEventTimestampRef.current = latestPedometer.timestamp;
      }

      movementQueueRef.current = appendActorMovementTargets(
        movementQueueRef.current,
        movementUpdate.acceptedStepPositions,
        {
          cadenceStepsPerMinute: latestPedometer?.cadence ?? null,
          eventIntervalMs,
        },
      );
      if (
        activeMovementTargetRef.current === null &&
        movementQueueRef.current.targets.length > 0
      ) {
        activateNextMovementTarget();
      }
      setProcessingStatus('processed');
      return;
    }
    setProcessingStatus(sensorSamples.length > 0 ? 'ignored' : 'waiting');
  }, [activateNextMovementTarget, constraintMapInput, sensorSamples]);

  useEffect(() => {
    if (navigationState.routeStatus !== 'idle') {
      return;
    }
    setNavigationState((currentState) =>
      calculateNavigationRoute(currentState, mapData.movement.routeGraph),
    );
  }, [mapData.movement.routeGraph, navigationState.routeStatus]);

  useEffect(() => {
    if (
      !shouldContinueActorSmoothing(
        displayActorPositionRef.current,
        renderTargetPosition,
      )
    ) {
      if (
        displayActorPositionRef.current.x !== renderTargetPosition.x ||
        displayActorPositionRef.current.y !== renderTargetPosition.y
      ) {
        displayActorPositionRef.current = renderTargetPosition;
        previousPositionRef.current = renderTargetPosition;
        setDisplayActorPosition(renderTargetPosition);
      }
      activeMovementTargetRef.current = null;
      if (activateNextMovementTarget()) {
        stopActorSmoothing();
        return;
      }
      setBobMotionState((currentMotionState) => ({
        direction: currentMotionState.direction,
        action: 'idle',
      }));
      stopActorSmoothing();
      return;
    }

    if (smoothingFrameRef.current !== null) {
      return;
    }

    const stepFrame = (timestamp: number) => {
      const previousTimestamp = smoothingTimestampRef.current ?? timestamp;
      smoothingTimestampRef.current = timestamp;
      const elapsedMs = Math.max(16, timestamp - previousTimestamp);
      const maxDistanceMeters =
        (activeMovementSpeedRef.current * elapsedMs) / 1000;
      const currentDisplayPosition = displayActorPositionRef.current;
      const targetPosition = renderTargetPosition;
      const nextDisplayPosition = stepActorRenderPosition(
        currentDisplayPosition,
        targetPosition,
        maxDistanceMeters,
      );
      const renderDelta = {
        x: nextDisplayPosition.x - currentDisplayPosition.x,
        y: nextDisplayPosition.y - currentDisplayPosition.y,
      };

      displayActorPositionRef.current = nextDisplayPosition;
      previousPositionRef.current = nextDisplayPosition;
      setDisplayActorPosition(nextDisplayPosition);
      setBobMotionState((currentMotionState) =>
        deriveActorMotionState(currentMotionState, renderDelta),
      );

      if (shouldContinueActorSmoothing(nextDisplayPosition, targetPosition)) {
        smoothingFrameRef.current = requestAnimationFrame(stepFrame);
        return;
      }

      stopActorSmoothing();
      displayActorPositionRef.current = targetPosition;
      previousPositionRef.current = targetPosition;
      setDisplayActorPosition(targetPosition);
      activeMovementTargetRef.current = null;
      if (activateNextMovementTarget()) {
        return;
      }
      setBobMotionState((currentMotionState) => ({
        direction: currentMotionState.direction,
        action: 'idle',
      }));
    };

    smoothingFrameRef.current = requestAnimationFrame(stepFrame);
    return stopActorSmoothing;
  }, [
    activateNextMovementTarget,
    renderTargetPosition,
    stopActorSmoothing,
  ]);

  useEffect(() => stopActorSmoothing, [stopActorSmoothing]);

  const movementState = movementRuntimeRef.current?.getState() ?? {
    position: actorPosition,
    headingRadians: 0,
    headingConfidence: 0,
    confidence: 0.8,
  };
  useEffect(() => {
    const targetHeading = movementState.headingRadians;
    if (
      Math.abs(shortestHeadingDelta(displayHeadingRef.current, targetHeading)) <
      0.001
    ) {
      displayHeadingRef.current = targetHeading;
      setDisplayHeadingRadians(targetHeading);
      stopHeadingSmoothing();
      return;
    }
    if (headingFrameRef.current !== null) {
      return;
    }

    const stepFrame = (timestamp: number) => {
      const previousTimestamp = headingTimestampRef.current ?? timestamp;
      headingTimestampRef.current = timestamp;
      const elapsedMs = Math.max(16, timestamp - previousTimestamp);
      const maximumDelta =
        (HEADING_RENDER_SPEED_RADIANS_PER_SECOND * elapsedMs) / 1000;
      const nextHeading = stepHeadingToward(
        displayHeadingRef.current,
        targetHeading,
        maximumDelta,
      );
      displayHeadingRef.current = nextHeading;
      setDisplayHeadingRadians(nextHeading);

      if (Math.abs(shortestHeadingDelta(nextHeading, targetHeading)) >= 0.001) {
        headingFrameRef.current = requestAnimationFrame(stepFrame);
        return;
      }

      stopHeadingSmoothing();
      displayHeadingRef.current = targetHeading;
      setDisplayHeadingRadians(targetHeading);
    };

    headingFrameRef.current = requestAnimationFrame(stepFrame);
    return stopHeadingSmoothing;
  }, [movementState.headingRadians, stopHeadingSmoothing]);

  useEffect(() => stopHeadingSmoothing, [stopHeadingSmoothing]);

  const headingConfidence = movementState.headingConfidence ?? 0;
  const positionConfidence = movementState.confidence ?? 0;
  const routePolyline = useMemo(
    () => buildRoutePolyline(navigationState.highlightedPath, mapData.movement.routeGraph),
    [mapData.movement.routeGraph, navigationState.highlightedPath],
  );
  const headingRadians =
    headingConfidence >= 0.35
      ? displayHeadingRadians
      : directionToHeadingRadians(bobMotionState.direction);
  const guidance = useMemo(
    () =>
      buildNavigationGuidance(
        {
          positionMeters: actorPosition,
          headingRadians,
          headingConfidence,
          positionConfidence,
        },
        routePolyline,
      ),
    [
      actorPosition,
      headingConfidence,
      headingRadians,
      positionConfidence,
      routePolyline,
    ],
  );
  const visualActorDirection =
    headingConfidence >= 0.35
      ? deriveActorDirectionFromHeading(headingRadians, bobMotionState.direction)
      : bobMotionState.direction;

  const actors = useMemo(
    () => [
      {
        ...startingActor,
        position: displayActorPosition,
        direction: visualActorDirection,
        action: bobMotionState.action,
        label: 'You',
        headingRadians,
        isUser: true,
      },
    ],
    [
      bobMotionState.action,
      displayActorPosition,
      headingRadians,
      startingActor,
      visualActorDirection,
    ],
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
  const viewportSize = useMemo(
    () => ({ width: Math.max(1, viewportWidth), height }),
    [height, viewportWidth],
  );
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
  const followBaseCamera = useMemo(
    () =>
      createNavigationViewportCamera(
        bobPoint,
        viewportSize,
        mapData.coordinateSystem.pixelsPerMeter,
        FOLLOW_VISIBLE_WIDTH_METERS,
        FOLLOW_VISIBLE_HEIGHT_METERS,
      ),
    [bobPoint, mapData.coordinateSystem.pixelsPerMeter, viewportSize],
  );
  const freeLookBaseCamera = useMemo(
    () =>
      createNavigationViewportCamera(
        bobPoint,
        viewportSize,
        mapData.coordinateSystem.pixelsPerMeter,
        FREE_LOOK_VISIBLE_WIDTH_METERS,
        FREE_LOOK_VISIBLE_HEIGHT_METERS,
      ),
    [bobPoint, mapData.coordinateSystem.pixelsPerMeter, viewportSize],
  );
  const applyFollowTarget = useCallback(
    (nextCamera: CameraState) => {
      const cameraWithFollowScale = setCameraZoom(nextCamera, followBaseCamera.scale);
      return constrainCameraToBounds(
        centerCameraOnPoint(cameraWithFollowScale, bobPoint, viewportSize),
        sceneBounds,
        viewportSize,
      );
    },
    [bobPoint, followBaseCamera.scale, sceneBounds, viewportSize],
  );
  const debugSnapshot = useMemo(
    () =>
      buildMovementDebugSnapshot({
        samples: sensorSamples,
        state: movementState,
        status: processingStatus,
        destinationNodeId,
        destinationAvailable: destinationNode !== null,
        pedometer: {
          latestKnownSteps: latestKnownPedometerSteps,
          baselineSteps: pedometerBaselineSteps,
        },
        acceptedStepPositionCount: latestAcceptedStepPositionCount,
      }),
    [
      destinationNode,
      destinationNodeId,
      latestKnownPedometerSteps,
      latestAcceptedStepPositionCount,
      movementState,
      pedometerBaselineSteps,
      processingStatus,
      sensorSamples,
    ],
  );

  const navigationSnapshot = useMemo<ArenaMapNavigationSnapshot>(
    () => ({
      destinationLabel: destinationNode
        ? destinationLabelFor(destinationNode.node_id ?? destinationNode.id ?? destinationNodeId)
        : destinationLabelFor(destinationNodeId),
      remainingDistanceMeters: guidance?.remainingDistanceMeters ?? 0,
      estimatedTimeSeconds: guidance?.estimatedTimeSeconds ?? 0,
      estimatedSteps: Math.max(
        0,
        Math.round((guidance?.remainingDistanceMeters ?? 0) / DEFAULT_STEP_LENGTH_METERS),
      ),
      nextStep: guidance?.cue.message ?? 'Route unavailable',
      cue: guidance?.cue ?? null,
      nextCue: guidance?.nextCue ?? null,
      hasRoute: guidance !== null,
    }),
    [destinationNode, destinationNodeId, guidance],
  );

  useEffect(() => {
    onNavigationStateChange?.(navigationSnapshot);
  }, [navigationSnapshot, onNavigationStateChange]);

  useEffect(() => {
    onDeveloperToolsStateChange?.({
      debugSnapshot,
      navigationState,
      selectableDestinations,
      onSelectDestination: handleSelectDestination,
      onCalculateRoute: handleCalculateRoute,
      onClearRoute: handleClearRoute,
      onToggleUnwalkable: handleToggleUnwalkable,
      onResetNavigation: handleResetNavigation,
    });

    return () => onDeveloperToolsStateChange?.(null);
  }, [
    debugSnapshot,
    navigationState,
    onDeveloperToolsStateChange,
    selectableDestinations,
  ]);

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
      setCamera((currentCamera) => currentCamera ?? followBaseCamera);
    }
  }, [followBaseCamera, viewportWidth]);

  useEffect(() => {
    if (!followsBob || viewportWidth <= 0) {
      return;
    }
    setCamera((currentCamera) => applyFollowTarget(currentCamera ?? followBaseCamera));
  }, [applyFollowTarget, followBaseCamera, followsBob, viewportWidth]);

  const renderedCamera =
    camera ??
    (followsBob
      ? applyFollowTarget(followBaseCamera)
      : constrainCameraToBounds(freeLookBaseCamera, sceneBounds, viewportSize));

  function handleCameraChange(nextCamera: CameraState) {
    setCamera(constrainCameraToBounds(nextCamera, sceneBounds, viewportSize));
  }

  function handleCameraInteractionStart() {
    setCameraMode(enterManualPan);
  }

  function handleZoomButton(factor: number) {
    const focalPoint = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    setCamera((currentCamera) => {
      const zoomedCamera = zoomCamera(
        currentCamera ?? renderedCamera,
        factor,
        undefined,
        undefined,
        focalPoint,
      );
      return followsBob
        ? applyFollowTarget(zoomedCamera)
        : constrainCameraToBounds(zoomedCamera, sceneBounds, viewportSize);
    });
  }

  function handleToggleFollowBob() {
    if (followsBob) {
      setCameraMode(enterManualPan);
      return;
    }
    handleRecenter();
  }

  function handleRecenter() {
    setCameraMode(recenterActor);
    setCamera((currentCamera) => applyFollowTarget(currentCamera ?? renderedCamera));
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

  viewportControlHandlersRef.current = {
    zoomIn: () => handleZoomButton(1.2),
    zoomOut: () => handleZoomButton(1 / 1.2),
    toggleFollow: handleToggleFollowBob,
    recenter: handleRecenter,
  };

  useEffect(() => {
    onViewportControlsStateChange?.({
      floorLabel: 'Floor 1',
      followsBob,
      onZoomIn: () => viewportControlHandlersRef.current.zoomIn(),
      onZoomOut: () => viewportControlHandlersRef.current.zoomOut(),
      onToggleFollowBob: () =>
        viewportControlHandlersRef.current.toggleFollow(),
      onRecenter: () => viewportControlHandlersRef.current.recenter(),
    });

    return () => onViewportControlsStateChange?.(null);
  }, [followsBob, onViewportControlsStateChange]);

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
    </View>
  );
}

const styles = StyleSheet.create({
  engine: {
    position: 'relative',
  },
});
