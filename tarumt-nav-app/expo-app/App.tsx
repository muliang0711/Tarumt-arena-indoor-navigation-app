import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import demoMap from './assets/maps/demo_1.tmj.json';
import demoEdges from './assets/maps/demo_1.edges.json';
import { AppHeader, SimulationControls } from './src/components/app';
import { EdgeEditorPanel } from './src/components/edgeEditor';
import { IndoorMapViewport } from './src/components/map';
import { NavigationStatsPanel } from './src/components/navigation';
import { DerivedEstimatePanel } from './src/components/navigationInput';
import {
  createRouteMetricModel,
  createEdgePathSegments,
  createNodeDistance,
  createRouteGraphEdge,
  findPixelsPerMeterAtRoutePosition,
  stringifyRouteGraphEdgeDocument,
} from './src/edgeEditor';
import type {
  EdgeFieldDraft,
  RouteGraphEdgeDocument,
  RouteGraphEdgeExport,
} from './src/edgeEditor';
import { createNavigationUiState } from './src/navigation';
import {
  useDerivedEstimateBridge,
  useRawMotionPdrConsumer,
} from './src/navigationInput';
import { useWrongWayRerouteMonitor } from './src/reroute';
import { useRouteSimulation } from './src/simulation/useRouteSimulation';
import {
  createAcceptedRouteHeadingDegrees,
  constrainEstimateToRouteProgress,
  createPngMapModel,
  createRemainingRouteSegments,
  createTurnAwareRoutePosition,
} from './src/tiled/model';
import type { OverlayRouteNode, RouteSnapResult, TiledMap } from './src/tiled/type';
import { DEFAULT_PDR_PIPELINE_CONFIG } from './src/pdr';

const demoMapImage = require('./assets/maps/demo_1.png');
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const demoEdgeDocument = demoEdges as RouteGraphEdgeDocument;
type AppMode = 'edges' | 'navigate';

export default function App() {
  const [mode, setMode] = useState<AppMode>('navigate');
  const [zoomIndex, setZoomIndex] = useState(2);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [draftPairKey, setDraftPairKey] = useState('');
  const [edgeId, setEdgeId] = useState('');
  const [distance, setDistance] = useState('');
  const [edgeFields, setEdgeFields] = useState<EdgeFieldDraft[]>([]);
  const [edges, setEdges] = useState<RouteGraphEdgeExport[]>(
    () => [...demoEdgeDocument.edges],
  );
  const [sensorRouteSnap, setSensorRouteSnap] =
    useState<RouteSnapResult | null>(null);
  const mapModel = useMemo(() => createPngMapModel(demoMap as TiledMap), []);
  const nodesById = useMemo(
    () => new Map(mapModel.routeNodes.map((node) => [node.nodeId, node])),
    [mapModel.routeNodes],
  );
  const selectedNodes = useMemo(
    () =>
      selectedNodeIds
        .map((nodeId) => nodesById.get(nodeId))
        .filter((node): node is OverlayRouteNode => Boolean(node)),
    [nodesById, selectedNodeIds],
  );
  const fromNode = selectedNodes[0] ?? null;
  const toNode = selectedNodes[1] ?? null;
  const pendingPairKey =
    fromNode && toNode ? `${fromNode.nodeId}->${toNode.nodeId}` : '';
  const routeSimulation = useRouteSimulation(mapModel.routePath);
  const blueMarkerPosition =
    sensorRouteSnap?.position ?? routeSimulation.blueMarkerPosition;
  const derivedEstimateBridge = useDerivedEstimateBridge({
    initialRedMarker: mapModel.redMarker,
    routePosition: blueMarkerPosition,
    surface: mapModel.surface,
  });
  const routeMotionTargetPosition = useMemo(
    () =>
      createTurnAwareRoutePosition({
        observedHeadingDegrees: derivedEstimateBridge.redMarker.headingDegrees,
        routePath: mapModel.routePath,
        routePosition: blueMarkerPosition,
      }),
    [
      blueMarkerPosition,
      derivedEstimateBridge.redMarker.headingDegrees,
      mapModel.routePath,
    ],
  );
  const acceptedRouteHeadingDegrees = useMemo(
    () =>
      createAcceptedRouteHeadingDegrees({
        routePath: mapModel.routePath,
        routePosition: blueMarkerPosition,
      }),
    [blueMarkerPosition, mapModel.routePath],
  );
  const remainingPathSegments = useMemo(
    () =>
      createRemainingRouteSegments(
        mapModel.routePath,
        blueMarkerPosition.distanceAlongRoute,
      ),
    [blueMarkerPosition.distanceAlongRoute, mapModel.routePath],
  );
  const distanceRemainingPixels = Math.max(
    0,
    routeSimulation.routeDistancePixels - blueMarkerPosition.distanceAlongRoute,
  );
  const navigationStatus =
    sensorRouteSnap && distanceRemainingPixels <= 0
      ? 'arrived'
      : sensorRouteSnap
        ? 'moving'
        : routeSimulation.status;
  const routeMetrics = useMemo(
    () => createRouteMetricModel(mapModel.routePath, demoEdgeDocument.edges),
    [mapModel.routePath],
  );
  const pixelsPerMeter = useMemo(
    () =>
      findPixelsPerMeterAtRoutePosition({
        metrics: routeMetrics,
        position: blueMarkerPosition,
      }),
    [blueMarkerPosition, routeMetrics],
  );
  const rawMotionPdrConsumer = useRawMotionPdrConsumer({
    initialRedMarker: mapModel.redMarker,
    onEstimate: derivedEstimateBridge.ingestExternalEstimate,
    onHeading: derivedEstimateBridge.updateHeadingOnly,
    pixelsPerMeter,
    routePosition: routeMotionTargetPosition,
  });
  const wrongWayRerouteMonitor = useWrongWayRerouteMonitor({
    acceptedExpectedHeadingDegrees: acceptedRouteHeadingDegrees,
    observedHeadingDegrees: derivedEstimateBridge.redMarker.headingDegrees,
    routeNodes: mapModel.routeNodes,
    routePosition: blueMarkerPosition,
  });
  const navigationUi = useMemo(
    () =>
      createNavigationUiState({
        distanceRemainingPixels,
        routeDistancePixels: routeSimulation.routeDistancePixels,
        routePath: mapModel.routePath,
        routePosition: blueMarkerPosition,
        status: navigationStatus,
      }),
    [
      blueMarkerPosition,
      distanceRemainingPixels,
      mapModel.routePath,
      routeSimulation.routeDistancePixels,
      navigationStatus,
    ],
  );
  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const edgeSegments = useMemo(
    () => createEdgePathSegments(edges, mapModel.routeNodes),
    [edges, mapModel.routeNodes],
  );
  const edgeJson = useMemo(
    () => stringifyRouteGraphEdgeDocument(edges, 'demo_1.tmj'),
    [edges],
  );
  const canSaveEdge =
    Boolean(fromNode && toNode && edgeId.trim()) &&
    Number.isFinite(Number(distance));

  useEffect(() => {
    const latestEstimate = derivedEstimateBridge.latestEstimate;
    if (!latestEstimate) {
      return;
    }

    setSensorRouteSnap((currentRouteSnap) =>
      constrainEstimateToRouteProgress({
        estimate: {
          headingDegrees: latestEstimate.headingDegrees,
          screenX: latestEstimate.x,
          screenY: latestEstimate.y,
        },
        previousPosition:
          currentRouteSnap?.position ?? routeSimulation.blueMarkerPosition,
        routePath: mapModel.routePath,
      }),
    );
  }, [
    derivedEstimateBridge.latestEstimate,
    mapModel.routePath,
    routeSimulation.blueMarkerPosition,
  ]);

  useEffect(() => {
    if (!fromNode || !toNode) {
      if (draftPairKey) {
        setDraftPairKey('');
      }
      return;
    }

    if (pendingPairKey === draftPairKey) {
      return;
    }

    setDraftPairKey(pendingPairKey);
    setEdgeId(`edge-${fromNode.nodeId}-${toNode.nodeId}`);
    setDistance(String(createNodeDistance(fromNode, toNode)));
    setEdgeFields([]);
  }, [draftPairKey, fromNode, pendingPairKey, toNode]);

  function zoomOut() {
    setZoomIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function zoomIn() {
    setZoomIndex((currentIndex) =>
      Math.min(ZOOM_STEPS.length - 1, currentIndex + 1),
    );
  }

  function resetNavigationInput() {
    rawMotionPdrConsumer.reset();
    derivedEstimateBridge.reset();
    setSensorRouteSnap(null);
    wrongWayRerouteMonitor.reset();
  }

  function startRawMotionInput() {
    routeSimulation.pause();
    rawMotionPdrConsumer.start();
  }

  function changeMode(nextMode: AppMode) {
    setMode(nextMode);
    if (nextMode === 'navigate') {
      setSelectedNodeIds([]);
    }
  }

  function selectRouteNode(node: OverlayRouteNode) {
    if (mode !== 'edges') {
      return;
    }

    setSelectedNodeIds((currentNodeIds) => {
      if (currentNodeIds.length === 0) {
        return [node.nodeId];
      }

      if (currentNodeIds.length === 1) {
        const currentNodeId = currentNodeIds[0];
        if (!currentNodeId || currentNodeId === node.nodeId) {
          return [];
        }

        return [currentNodeId, node.nodeId];
      }

      return [node.nodeId];
    });
  }

  function updateEdgeField(
    fieldIndex: number,
    property: keyof EdgeFieldDraft,
    value: string,
  ) {
    setEdgeFields((currentFields) =>
      currentFields.map((field, index) =>
        index === fieldIndex ? { ...field, [property]: value } : field,
      ),
    );
  }

  function saveEdge() {
    if (!fromNode || !toNode || !canSaveEdge) {
      return;
    }

    const edge = createRouteGraphEdge({
      distance: Number(distance),
      fields: edgeFields,
      from: fromNode.nodeId,
      id: edgeId,
      to: toNode.nodeId,
    });

    setEdges((currentEdges) => [
      ...currentEdges.filter((currentEdge) => currentEdge.id !== edge.id),
      edge,
    ]);
    setSelectedNodeIds([]);
  }

  function addEdgeField() {
    setEdgeFields((currentFields) => [...currentFields, { key: '', value: '' }]);
  }

  function removeEdgeField(fieldIndex: number) {
    setEdgeFields((currentFields) =>
      currentFields.filter((_, index) => index !== fieldIndex),
    );
  }

  function removeEdge(edgeIdToRemove: string) {
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.id !== edgeIdToRemove),
    );
  }

  function downloadEdgesJson() {
    const runtime = globalThis as unknown as {
      Blob?: new (parts: string[], options: { type: string }) => unknown;
      URL?: {
        createObjectURL: (blob: unknown) => string;
        revokeObjectURL: (url: string) => void;
      };
      document?: {
        createElement: (tagName: 'a') => {
          click: () => void;
          download: string;
          href: string;
        };
      };
    };

    if (!runtime.Blob || !runtime.URL || !runtime.document) {
      return;
    }

    const blob = new runtime.Blob([edgeJson], { type: 'application/json' });
    const url = runtime.URL.createObjectURL(blob);
    const anchor = runtime.document.createElement('a');
    anchor.href = url;
    anchor.download = 'demo_1.edges.json';
    anchor.click();
    runtime.URL.revokeObjectURL(url);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader
        distanceRemainingPixels={distanceRemainingPixels}
        mode={mode}
        onModeChange={changeMode}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        status={navigationStatus}
        zoomPercent={Math.round(zoom * 100)}
      />
      {mode === 'navigate' ? (
        <>
          <SimulationControls
            onPause={routeSimulation.pause}
            onReset={routeSimulation.reset}
            onStart={routeSimulation.start}
            onStepForward={routeSimulation.stepForward}
          />
          <NavigationStatsPanel navigation={navigationUi} />
          <DerivedEstimatePanel
            buffer={derivedEstimateBridge.buffer}
            lastResult={derivedEstimateBridge.lastResult}
            onReplayStep={derivedEstimateBridge.runReplayStep}
            onReset={resetNavigationInput}
            onStartRawMotion={startRawMotionInput}
            onStopRawMotion={rawMotionPdrConsumer.stop}
            rawMotionStats={rawMotionPdrConsumer.stats}
            rawMotionStatus={rawMotionPdrConsumer.status}
            routeTotalMeters={routeMetrics.totalMeters}
            snapDriftPixels={sensorRouteSnap?.driftPixels ?? null}
            stepLengthMeters={DEFAULT_PDR_PIPELINE_CONFIG.stepLengthMeters}
            stepLengthPixels={
              DEFAULT_PDR_PIPELINE_CONFIG.stepLengthMeters * pixelsPerMeter
            }
            wrongWayReroute={wrongWayRerouteMonitor.result}
          />
        </>
      ) : (
        <EdgeEditorPanel
          canSaveEdge={canSaveEdge}
          distance={distance}
          edgeId={edgeId}
          edgeJson={edgeJson}
          edges={edges}
          fields={edgeFields}
          fromNodeId={fromNode?.nodeId ?? null}
          onAddField={addEdgeField}
          onChangeDistance={setDistance}
          onChangeEdgeId={setEdgeId}
          onDownloadJson={downloadEdgesJson}
          onRemoveEdge={removeEdge}
          onRemoveField={removeEdgeField}
          onSaveEdge={saveEdge}
          onUpdateField={updateEdgeField}
          selectedNodeIds={selectedNodeIds}
          toNodeId={toNode?.nodeId ?? null}
        />
      )}
      <IndoorMapViewport
        blueMarkerPosition={blueMarkerPosition}
        edgeSegments={edgeSegments}
        mapImage={demoMapImage}
        mapModel={mapModel}
        navigation={navigationUi}
        observedHeadingDegrees={derivedEstimateBridge.observedHeadingDegrees}
        onRouteNodePress={mode === 'edges' ? selectRouteNode : undefined}
        redMarker={derivedEstimateBridge.redMarker}
        remainingPathSegments={remainingPathSegments}
        selectedRouteNodeIds={selectedNodeIds}
        showNavigationOverlay={mode === 'navigate'}
        wrongWayReroute={wrongWayRerouteMonitor.result}
        zoom={zoom}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
});
