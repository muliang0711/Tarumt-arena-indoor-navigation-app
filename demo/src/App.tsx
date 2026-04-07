import { startTransition, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import { ControlBar } from './components/ControlBar'
import { DetailsPanel } from './components/DetailsPanel'
import { GraphCanvas } from './components/GraphCanvas'
import { LegendPanel } from './components/LegendPanel'
import { LayoutStudio } from './components/LayoutStudio'
import { filterGraphByFloor, parseGraphText } from './parsing/graphParser'
import { getLayoutPrefabDefinition } from './render/manualLayoutCatalog'
import { buildScene } from './transform/sceneBuilder'
import type { LayoutPrefabId, ManualLayoutItem, SceneMarkerOverride } from './types/layout'
import type { GraphNode, ParsedGraph } from './types/graph'

const SAMPLE_FILE = '/sample-graph.json'
const LAYOUT_STORAGE_KEY = 'demo-manual-layout-v1'
const MARKER_OVERRIDE_STORAGE_KEY = 'demo-marker-overrides-v1'

function App() {
  const [graph, setGraph] = useState<ParsedGraph | null>(null)
  const [activeFloor, setActiveFloor] = useState<number | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [renderMode, setRenderMode] = useState<'debug' | 'presentation'>('presentation')
  const [fileName, setFileName] = useState('sample-graph.json')
  const [fitRequestKey, setFitRequestKey] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingSample, setIsLoadingSample] = useState(false)
  const [editorEnabled, setEditorEnabled] = useState(false)
  const [selectedPrefabId, setSelectedPrefabId] = useState<LayoutPrefabId>('house_1')
  const [layoutItems, setLayoutItems] = useState<ManualLayoutItem[]>(() => readStoredLayout())
  const [markerOverrides, setMarkerOverrides] = useState<SceneMarkerOverride[]>(() =>
    readStoredMarkerOverrides(),
  )

  useEffect(() => {
    let isCancelled = false

    async function loadInitialSample() {
      setIsLoadingSample(true)
      try {
        const response = await fetch(SAMPLE_FILE)
        const text = await response.text()
        const nextGraph = parseGraphText(text)

        if (!isCancelled) {
          applyGraph(nextGraph, 'sample-graph.json')
          setErrorMessage(null)
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load sample graph.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSample(false)
        }
      }
    }

    void loadInitialSample()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!graph) {
      setActiveFloor(null)
      setSelectedNodeId(null)
      setHoveredNodeId(null)
      return
    }

    const nextFloor =
      activeFloor !== null && graph.floors.includes(activeFloor)
        ? activeFloor
        : graph.floors[0] ?? null

    if (nextFloor !== activeFloor) {
      setActiveFloor(nextFloor)
    }
  }, [activeFloor, graph])

  const floorGraph = useMemo(
    () => (graph ? filterGraphByFloor(graph, activeFloor) : null),
    [activeFloor, graph],
  )
  const floorMarkerOverrides = useMemo(
    () => markerOverrides.filter((item) => item.floorId === activeFloor),
    [activeFloor, markerOverrides],
  )
  const scene = useMemo(
    () =>
      floorGraph
        ? applyMarkerOverrides(buildScene(floorGraph), floorMarkerOverrides)
        : null,
    [floorGraph, floorMarkerOverrides],
  )
  const floorLayoutItems = useMemo(
    () => layoutItems.filter((item) => item.floorId === activeFloor),
    [activeFloor, layoutItems],
  )
  const layoutExport = useMemo(
    () =>
      JSON.stringify(
        {
          floorId: activeFloor,
          markerOverrides: floorMarkerOverrides,
          items: floorLayoutItems.map(({ col, floorId, height, id, prefabId, row, width }) => ({
            col,
            floorId,
            height,
            id,
            prefabId,
            row,
            width,
          })),
        },
        null,
        2,
      ),
    [activeFloor, floorLayoutItems],
  )
  const selectedNode = getNode(selectedNodeId, floorGraph, graph)
  const hoveredNode =
    hoveredNodeId && hoveredNodeId !== selectedNodeId
      ? getNode(hoveredNodeId, floorGraph, graph)
      : null

  useEffect(() => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutItems))
  }, [layoutItems])

  useEffect(() => {
    window.localStorage.setItem(
      MARKER_OVERRIDE_STORAGE_KEY,
      JSON.stringify(markerOverrides),
    )
  }, [markerOverrides])

  useEffect(() => {
    if (!floorGraph || !selectedNodeId) {
      return
    }

    if (!floorGraph.nodesById.has(selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [floorGraph, selectedNodeId])

  async function loadSampleGraph() {
    setIsLoadingSample(true)
    try {
      const response = await fetch(SAMPLE_FILE)
      const text = await response.text()
      const nextGraph = parseGraphText(text)
      applyGraph(nextGraph, 'sample-graph.json')
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load sample graph.',
      )
    } finally {
      setIsLoadingSample(false)
    }
  }

  function applyGraph(nextGraph: ParsedGraph, nextFileName: string) {
    startTransition(() => {
      setGraph(nextGraph)
      setFileName(nextFileName)
      setActiveFloor(nextGraph.floors[0] ?? null)
      setSelectedNodeId(null)
      setHoveredNodeId(null)
      setFitRequestKey((value) => value + 1)
    })
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const nextGraph = parseGraphText(text)
      applyGraph(nextGraph, file.name)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to parse the graph file.',
      )
    } finally {
      event.target.value = ''
    }
  }

  function placeLayoutItem(prefabId: Exclude<LayoutPrefabId, 'erase'>, col: number, row: number) {
    if (activeFloor === null) {
      return
    }

    const prefab = getLayoutPrefabDefinition(prefabId)
    const nextItem: ManualLayoutItem = {
      col,
      floorId: activeFloor,
      height: prefab.height,
      id: `${prefabId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      prefabId,
      row,
      width: prefab.width,
    }

    setLayoutItems((currentItems) => {
      const nextItems = currentItems.filter((item) =>
        item.floorId !== activeFloor || !itemsOverlap(item, nextItem),
      )
      return [...nextItems, nextItem]
    })
  }

  function removeLayoutItem(itemId: string) {
    setLayoutItems((currentItems) => currentItems.filter((item) => item.id !== itemId))
  }

  function moveSceneMarker(nodeId: string, col: number, row: number) {
    if (activeFloor === null) {
      return
    }

    setMarkerOverrides((currentItems) => {
      const nextItem: SceneMarkerOverride = {
        col,
        floorId: activeFloor,
        nodeId,
        row,
      }
      const withoutCurrent = currentItems.filter(
        (item) => !(item.floorId === activeFloor && item.nodeId === nodeId),
      )
      return [...withoutCurrent, nextItem]
    })
  }

  function clearCurrentFloorLayout() {
    if (activeFloor === null) {
      return
    }

    setLayoutItems((currentItems) => currentItems.filter((item) => item.floorId !== activeFloor))
    setMarkerOverrides((currentItems) =>
      currentItems.filter((item) => item.floorId !== activeFloor),
    )
  }

  async function copyLayoutExport() {
    try {
      await navigator.clipboard.writeText(layoutExport)
    } catch {
      setErrorMessage('Unable to copy layout JSON. Your browser blocked clipboard access.')
    }
  }

  return (
    <div className="app-shell">
      <ControlBar
        activeFloor={activeFloor}
        fileName={fileName}
        floors={graph?.floors ?? []}
        isLoadingSample={isLoadingSample}
        renderMode={renderMode}
        showLabels={showLabels}
        onClearSelection={() => {
          setSelectedNodeId(null)
          setHoveredNodeId(null)
        }}
        onFileSelect={handleFileSelect}
        onFitMap={() => setFitRequestKey((value) => value + 1)}
        onFloorChange={setActiveFloor}
        onLoadSample={() => void loadSampleGraph()}
        onModeToggle={() =>
          setRenderMode((mode) => (mode === 'presentation' ? 'debug' : 'presentation'))
        }
        onToggleLabels={() => setShowLabels((value) => !value)}
      />

      <div className="workspace">
        <main className="viewer-stage">
          {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

          <GraphCanvas
            key={`${fileName}-${activeFloor ?? 'none'}-${fitRequestKey}`}
            editorEnabled={editorEnabled}
            layoutItems={floorLayoutItems}
            renderMode={renderMode}
            selectedPrefabId={selectedPrefabId}
            scene={scene}
            selectedNodeId={selectedNodeId}
            showLabels={showLabels}
            onHoverNode={setHoveredNodeId}
            onMoveSceneMarker={moveSceneMarker}
            onPlaceLayoutItem={placeLayoutItem}
            onRemoveLayoutItem={removeLayoutItem}
            onSelectNode={setSelectedNodeId}
          />
        </main>

        <aside className="sidebar">
          <LayoutStudio
            activeFloor={activeFloor}
            editorEnabled={editorEnabled}
            exportText={layoutExport}
            itemCount={floorLayoutItems.length + floorMarkerOverrides.length}
            selectedPrefabId={selectedPrefabId}
            onClearFloor={clearCurrentFloorLayout}
            onCopyExport={() => void copyLayoutExport()}
            onToggleEditor={() => setEditorEnabled((value) => !value)}
            onSelectPrefab={setSelectedPrefabId}
          />
          <LegendPanel nodeTypes={floorGraph?.nodeTypes ?? []} />
          <DetailsPanel
            activeFloor={activeFloor}
            hoveredNode={hoveredNode}
            renderMode={renderMode}
            selectedNode={selectedNode}
            tileCount={scene?.tiles.length ?? 0}
            visibleEdgeCount={floorGraph?.edges.length ?? 0}
            visibleNodeCount={floorGraph?.nodes.length ?? 0}
          />
        </aside>
      </div>
    </div>
  )
}

function getNode(
  nodeId: string | null,
  floorGraph: ReturnType<typeof filterGraphByFloor>,
  graph: ParsedGraph | null,
): GraphNode | null {
  if (!nodeId) {
    return null
  }

  return floorGraph?.nodesById.get(nodeId) ?? graph?.nodesById.get(nodeId) ?? null
}

function readStoredLayout(): ManualLayoutItem[] {
  const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isManualLayoutItem)
  } catch {
    return []
  }
}

function readStoredMarkerOverrides(): SceneMarkerOverride[] {
  const saved = window.localStorage.getItem(MARKER_OVERRIDE_STORAGE_KEY)
  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isSceneMarkerOverride)
  } catch {
    return []
  }
}

function isManualLayoutItem(value: unknown): value is ManualLayoutItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    typeof entry.prefabId === 'string' &&
    typeof entry.floorId === 'number' &&
    typeof entry.col === 'number' &&
    typeof entry.row === 'number' &&
    typeof entry.width === 'number' &&
    typeof entry.height === 'number'
  )
}

function isSceneMarkerOverride(value: unknown): value is SceneMarkerOverride {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entry = value as Record<string, unknown>
  return (
    typeof entry.nodeId === 'string' &&
    typeof entry.floorId === 'number' &&
    typeof entry.col === 'number' &&
    typeof entry.row === 'number'
  )
}

function applyMarkerOverrides(
  scene: ReturnType<typeof buildScene>,
  overrides: SceneMarkerOverride[],
) {
  if (overrides.length === 0) {
    return scene
  }

  const overrideMap = new Map(overrides.map((item) => [item.nodeId, item]))

  return {
    ...scene,
    markers: scene.markers.map((marker) => {
      const override = overrideMap.get(marker.nodeId)
      return override ? { ...marker, col: override.col, row: override.row } : marker
    }),
  }
}

function itemsOverlap(left: ManualLayoutItem, right: ManualLayoutItem): boolean {
  return !(
    left.col + left.width <= right.col ||
    right.col + right.width <= left.col ||
    left.row + left.height <= right.row ||
    right.row + right.height <= left.row
  )
}

export default App
