import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import './App.css'
import { GraphCanvas } from './components/GraphCanvas'
import { PropertyPanel } from './components/PropertyPanel'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'
import { seedGraphDataset } from './data/seedGraph'
import {
  DEFAULT_LATTICE_SPACING,
  clampPoint,
  createGraphEdge,
  createGraphNode,
  getClientPointInSvg,
  getNearestAnchorPoint,
  isPointNearAnchor,
  parseGraphDataset,
  serializeGraphDataset,
  validateGraphDataset,
} from './lib/graph'
import type {
  EditorMode,
  GraphDataset,
  GraphEdge,
  GraphNode,
  NodeDefaults,
  Point,
  Selection,
} from './types/graph'

type Interaction =
  | {
      kind: 'drag-node'
      nodeId: string
      pointerStart: Point
      nodeStart: Point
    }
  | {
      kind: 'pan'
      pointerStartClient: Point
      scrollStart: { left: number; top: number }
    }

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

function App() {
  const [dataset, setDataset] = useState<GraphDataset>(seedGraphDataset)
  const [mode, setMode] = useState<EditorMode>('select')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [pendingEdgeStartId, setPendingEdgeStartId] = useState<string | null>(null)
  const [nodeDefaults, setNodeDefaults] = useState<NodeDefaults>({
    floor_id: 1,
    type: 'junction',
  })
  const [edgeDefaults, setEdgeDefaults] = useState({
    bidirectional: true,
    weight: 1,
  })
  const [showGrid, setShowGrid] = useState(true)
  const [latticeSpacing, setLatticeSpacing] = useState(DEFAULT_LATTICE_SPACING)
  const [showBackground, setShowBackground] = useState(true)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pointerPosition, setPointerPosition] = useState<Point | null>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [interaction, setInteraction] = useState<Interaction | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)

  const validation = validateGraphDataset(dataset)
  const isPanning = interaction?.kind === 'pan'
  const hoveredAnchor =
    mode === 'addNode' && pointerPosition
      ? (() => {
          const anchor = getNearestAnchorPoint(pointerPosition, latticeSpacing)
          return isPointNearAnchor(pointerPosition, anchor, latticeSpacing)
            ? anchor
            : null
        })()
      : null

  const deleteNodeById = useCallback((nodeId: string) => {
    setDataset((current) => ({
      nodes: current.nodes.filter((node) => node.node_id !== nodeId),
      edges: current.edges.filter(
        (edge) => edge.from_node !== nodeId && edge.to_node !== nodeId,
      ),
    }))
    setPendingEdgeStartId((current) => (current === nodeId ? null : current))
    setSelection((current) =>
      current?.kind === 'node' && current.id === nodeId ? null : current,
    )
  }, [])

  const deleteEdgeById = useCallback((edgeId: string) => {
    setDataset((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.edge_id !== edgeId),
    }))
    setSelection((current) =>
      current?.kind === 'edge' && current.id === edgeId ? null : current,
    )
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        event.preventDefault()
        setIsSpacePressed(true)
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selection &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        if (selection.kind === 'node') {
          deleteNodeById(selection.id)
        } else {
          deleteEdgeById(selection.id)
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [deleteEdgeById, deleteNodeById, selection])

  useEffect(() => {
    if (!interaction) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (interaction.kind === 'pan') {
        const viewport = viewportRef.current
        if (!viewport) {
          return
        }

        viewport.scrollLeft =
          interaction.scrollStart.left -
          (event.clientX - interaction.pointerStartClient.x)
        viewport.scrollTop =
          interaction.scrollStart.top -
          (event.clientY - interaction.pointerStartClient.y)
        return
      }

      const rawPoint = getClientPointInSvg(
        svgRef.current,
        event.clientX,
        event.clientY,
      )

      if (!rawPoint) {
        return
      }

      setPointerPosition(rawPoint)
      const point = getNearestAnchorPoint(rawPoint, latticeSpacing)
      const deltaX = point.x - interaction.pointerStart.x
      const deltaY = point.y - interaction.pointerStart.y

      setDataset((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.node_id === interaction.nodeId
            ? {
                ...node,
                ...clampPoint({
                  x: interaction.nodeStart.x + deltaX,
                  y: interaction.nodeStart.y + deltaY,
                }),
              }
            : node,
        ),
      }))
    }

    const handlePointerUp = () => {
      setInteraction(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [interaction, latticeSpacing])

  const updateNode = (
    nodeId: string,
    updater: (node: GraphNode) => GraphNode,
  ) => {
    let nextNodeId = nodeId

    setDataset((current) => {
      const existing = current.nodes.find((node) => node.node_id === nodeId)
      if (!existing) {
        return current
      }

      const nextNode = updater(existing)
      const clampedPosition = clampPoint({ x: nextNode.x, y: nextNode.y })
      const snappedPosition = getNearestAnchorPoint(clampedPosition, latticeSpacing)
      const normalizedNode: GraphNode = {
        ...nextNode,
        x: snappedPosition.x,
        y: snappedPosition.y,
      }
      nextNodeId = normalizedNode.node_id

      return {
        nodes: current.nodes.map((node) =>
          node.node_id === nodeId ? normalizedNode : node,
        ),
        edges: current.edges.map((edge) => ({
          ...edge,
          from_node:
            edge.from_node === nodeId ? normalizedNode.node_id : edge.from_node,
          to_node: edge.to_node === nodeId ? normalizedNode.node_id : edge.to_node,
        })),
      }
    })

    setSelection((current) =>
      current?.kind === 'node' && current.id === nodeId
        ? { kind: 'node', id: nextNodeId }
        : current,
    )
    setPendingEdgeStartId((current) => (current === nodeId ? nextNodeId : current))
  }

  const updateEdge = (
    edgeId: string,
    updater: (edge: GraphEdge) => GraphEdge,
  ) => {
    setDataset((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.edge_id === edgeId ? updater(edge) : edge,
      ),
    }))
  }

  const deleteSelection = useCallback(() => {
    if (!selection) {
      return
    }

    if (selection.kind === 'node') {
      deleteNodeById(selection.id)
    } else {
      deleteEdgeById(selection.id)
    }

    setSelection(null)
  }, [deleteEdgeById, deleteNodeById, selection])

  const handleCanvasPointerDown = (
    event: ReactPointerEvent<SVGRectElement>,
  ) => {
    if (event.button === 1 || isSpacePressed) {
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }

      event.preventDefault()
      setInteraction({
        kind: 'pan',
        pointerStartClient: { x: event.clientX, y: event.clientY },
        scrollStart: {
          left: viewport.scrollLeft,
          top: viewport.scrollTop,
        },
      })
      return
    }

    if (event.button !== 0) {
      return
    }

    const rawPoint = getClientPointInSvg(
      svgRef.current,
      event.clientX,
      event.clientY,
    )
    if (!rawPoint) {
      return
    }

    setPointerPosition(rawPoint)

    if (mode === 'select') {
      setSelection(null)
    }

    if (mode === 'addEdge') {
      setPendingEdgeStartId(null)
    }
  }

  const handleCanvasPointerMove = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    const point = getClientPointInSvg(
      svgRef.current,
      event.clientX,
      event.clientY,
    )
    setPointerPosition(point)
  }

  const handleNodePointerDown = (
    nodeId: string,
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    event.stopPropagation()

    const node = dataset.nodes.find((entry) => entry.node_id === nodeId)
    if (!node) {
      return
    }

    if (mode === 'delete') {
      deleteNodeById(nodeId)
      return
    }

    if (mode === 'addEdge') {
      if (!pendingEdgeStartId) {
        setPendingEdgeStartId(nodeId)
        setSelection({ kind: 'node', id: nodeId })
        return
      }

      if (pendingEdgeStartId === nodeId) {
        setPendingEdgeStartId(null)
        return
      }

      const edge = createGraphEdge(
        pendingEdgeStartId,
        nodeId,
        edgeDefaults,
        dataset.edges,
      )
      setDataset((current) => ({
        ...current,
        edges: [...current.edges, edge],
      }))
      setSelection({ kind: 'edge', id: edge.edge_id })
      setPendingEdgeStartId(null)
      return
    }

    if (mode !== 'select' || event.button !== 0) {
      return
    }

    const rawPoint = getClientPointInSvg(
      svgRef.current,
      event.clientX,
      event.clientY,
    )
    if (!rawPoint) {
      return
    }

    setSelection({ kind: 'node', id: nodeId })
    setInteraction({
      kind: 'drag-node',
      nodeId,
      pointerStart: getNearestAnchorPoint(rawPoint, latticeSpacing),
      nodeStart: { x: node.x, y: node.y },
    })
  }

  const handleAnchorPointerDown = (anchor: Point) => {
    if (mode !== 'addNode') {
      return
    }

    const node = createGraphNode(anchor, nodeDefaults, dataset.nodes)
    setDataset((current) => ({
      ...current,
      nodes: [...current.nodes, node],
    }))
    setSelection({ kind: 'node', id: node.node_id })
  }

  const handleEdgePointerDown = (
    edgeId: string,
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    event.stopPropagation()

    if (mode === 'delete') {
      deleteEdgeById(edgeId)
      return
    }

    if (mode === 'select') {
      setSelection({ kind: 'edge', id: edgeId })
    }
  }

  const handleImportGraph = () => {
    importInputRef.current?.click()
  }

  const handleImportChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = parseGraphDataset(JSON.parse(text))
      setDataset(parsed)
      setSelection(null)
      setPendingEdgeStartId(null)
    } catch (error) {
      window.alert(
        error instanceof Error ? `Import failed:\n${error.message}` : 'Import failed.',
      )
    } finally {
      event.target.value = ''
    }
  }

  const handleExportGraph = () => {
    const currentValidation = validateGraphDataset(dataset)
    if (currentValidation.errors.length > 0) {
      window.alert(`Export blocked:\n${currentValidation.errors.join('\n')}`)
      return
    }

    const blob = new Blob([serializeGraphDataset(dataset)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'navigation_graph_dataset.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleBackgroundUpload = () => {
    backgroundInputRef.current?.click()
  }

  const handleBackgroundChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBackgroundImageUrl(reader.result)
        setShowBackground(true)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleModeChange = (nextMode: EditorMode) => {
    setMode(nextMode)
    if (nextMode !== 'addEdge') {
      setPendingEdgeStartId(null)
    }
  }

  return (
    <div className="app-shell">
      <TopBar
        mode={mode}
        nodeCount={dataset.nodes.length}
        edgeCount={dataset.edges.length}
        errorCount={validation.errors.length}
        warningCount={validation.warnings.length}
        showGrid={showGrid}
        latticeSpacing={latticeSpacing}
        showBackground={showBackground}
        hasBackground={Boolean(backgroundImageUrl)}
        zoom={zoom}
        onImportGraph={handleImportGraph}
        onExportGraph={handleExportGraph}
        onLoadSample={() => {
          setDataset(seedGraphDataset)
          setSelection(null)
          setPendingEdgeStartId(null)
        }}
        onClearGraph={() => {
          setDataset({ nodes: [], edges: [] })
          setSelection(null)
          setPendingEdgeStartId(null)
        }}
        onLoadBackground={handleBackgroundUpload}
        onRemoveBackground={() => {
          setBackgroundImageUrl(null)
          setShowBackground(false)
        }}
        onToggleGrid={() => setShowGrid((current) => !current)}
        onToggleBackground={() => setShowBackground((current) => !current)}
        onLatticeSpacingChange={(nextSpacing) => {
          setLatticeSpacing(nextSpacing)
          setDataset((current) => ({
            ...current,
            nodes: current.nodes.map((node) => ({
              ...node,
              ...getNearestAnchorPoint({ x: node.x, y: node.y }, nextSpacing),
            })),
          }))
        }}
        onZoomChange={setZoom}
      />

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={handleImportChange}
      />
      <input
        ref={backgroundInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleBackgroundChange}
      />

      <main className="workspace-layout">
        <Toolbar
          mode={mode}
          nodeDefaults={nodeDefaults}
          edgeDefaults={edgeDefaults}
          pendingEdgeStartId={pendingEdgeStartId}
          onModeChange={handleModeChange}
          onNodeDefaultsChange={setNodeDefaults}
          onEdgeDefaultsChange={setEdgeDefaults}
        />

        <GraphCanvas
          dataset={dataset}
          selection={selection}
          mode={mode}
          pendingEdgeStartId={pendingEdgeStartId}
          pointerPosition={pointerPosition}
          hoveredAnchor={hoveredAnchor}
          latticeSpacing={latticeSpacing}
          showGrid={showGrid}
          showBackground={showBackground}
          backgroundImageUrl={backgroundImageUrl}
          zoom={zoom}
          isPanning={isPanning}
          isSpacePressed={isSpacePressed}
          svgRef={svgRef}
          viewportRef={viewportRef}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onCanvasPointerLeave={() => setPointerPosition(null)}
          onAnchorPointerDown={handleAnchorPointerDown}
          onNodePointerDown={handleNodePointerDown}
          onEdgePointerDown={handleEdgePointerDown}
        />

        <PropertyPanel
          dataset={dataset}
          selection={selection}
          validation={validation}
          onUpdateNode={updateNode}
          onUpdateEdge={updateEdge}
          onDeleteSelection={deleteSelection}
        />
      </main>
    </div>
  )
}

export default App
