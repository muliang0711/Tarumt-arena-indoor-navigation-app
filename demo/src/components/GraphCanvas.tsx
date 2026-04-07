import { useEffect, useRef, useState } from 'react'
import { drawScene, fitCameraToScene, hitTestMarker, screenToWorld } from '../render/pixelRenderer'
import type { CanvasCamera } from '../render/pixelRenderer'
import { getLayoutPrefabDefinition } from '../render/manualLayoutCatalog'
import { loadSampleSpriteSet } from '../render/sampleSpriteCatalog'
import type { SampleSpriteSet } from '../render/sampleSpriteCatalog'
import type { LayoutPrefabId, ManualLayoutItem } from '../types/layout'
import type { SceneData, SceneMarker } from '../types/scene'

interface GraphCanvasProps {
  editorEnabled: boolean
  layoutItems: ManualLayoutItem[]
  renderMode: 'debug' | 'presentation'
  selectedPrefabId: LayoutPrefabId
  scene: SceneData | null
  selectedNodeId: string | null
  showLabels: boolean
  onHoverNode: (nodeId: string | null) => void
  onMoveSceneMarker: (nodeId: string, col: number, row: number) => void
  onPlaceLayoutItem: (prefabId: Exclude<LayoutPrefabId, 'erase'>, col: number, row: number) => void
  onRemoveLayoutItem: (itemId: string) => void
  onSelectNode: (nodeId: string | null) => void
}

interface CanvasSize {
  height: number
  width: number
}

interface PointerDrag {
  moved: boolean
  pointerId: number
  startOffsetX: number
  startOffsetY: number
  startX: number
  startY: number
}

interface MarkerMoveDrag {
  marker: SceneMarker
  pointerId: number
  moved: boolean
  offsetX: number
  offsetY: number
  startX: number
  startY: number
}

export function GraphCanvas({
  editorEnabled,
  layoutItems,
  renderMode,
  selectedPrefabId,
  scene,
  selectedNodeId,
  showLabels,
  onHoverNode,
  onMoveSceneMarker,
  onPlaceLayoutItem,
  onRemoveLayoutItem,
  onSelectNode,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<PointerDrag | null>(null)
  const markerMoveRef = useRef<MarkerMoveDrag | null>(null)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ height: 0, width: 0 })
  const [camera, setCamera] = useState<CanvasCamera | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [layoutPreview, setLayoutPreview] = useState<{ col: number; row: number } | null>(null)
  const [sampleSprites, setSampleSprites] = useState<SampleSpriteSet | null>(null)

  useEffect(() => {
    let isMounted = true

    void loadSampleSpriteSet()
      .then((nextSprites) => {
        if (isMounted) {
          setSampleSprites(nextSprites)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSampleSprites(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const nextRect = entries[0]?.contentRect
      if (!nextRect) {
        return
      }

      const nextSize = {
        height: Math.max(Math.round(nextRect.height), 1),
        width: Math.max(Math.round(nextRect.width), 1),
      }

      setCanvasSize(nextSize)

      if (scene) {
        setCamera(fitCameraToScene(scene, nextSize.width, nextSize.height))
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [scene])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !scene || !camera || canvasSize.width === 0 || canvasSize.height === 0) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = Math.max(Math.floor(canvasSize.width * devicePixelRatio), 1)
    canvas.height = Math.max(Math.floor(canvasSize.height * devicePixelRatio), 1)
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    drawScene(context, scene, camera, canvasSize.width, canvasSize.height, {
      hoveredNodeId,
      layoutItems,
      layoutPreview:
        editorEnabled && selectedPrefabId !== 'erase' ? layoutPreview : null,
      renderMode,
      selectedNodeId,
      selectedPrefabId,
      showLabels,
      sprites: sampleSprites,
    })
  }, [
    camera,
    canvasSize,
    editorEnabled,
    hoveredNodeId,
    layoutItems,
    layoutPreview,
    renderMode,
    sampleSprites,
    scene,
    selectedNodeId,
    selectedPrefabId,
    showLabels,
  ])

  function readCanvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || !camera || !scene) {
      return null
    }

    return screenToWorld(camera, clientX - rect.left, clientY - rect.top)
  }

  function updateHover(clientX: number, clientY: number) {
    if (!scene || !camera) {
      return
    }

    const world = readCanvasPoint(clientX, clientY)
    if (!world) {
      return
    }

    const marker = hitTestMarker(scene, world.x, world.y)
    const nextNodeId = marker?.nodeId ?? null
    setHoveredNodeId(nextNodeId)
    onHoverNode(nextNodeId)
    setLayoutPreview({
      col: Math.floor(world.x / scene.tileSize),
      row: Math.floor(world.y / scene.tileSize),
    })
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!camera) {
      return
    }

    if (editorEnabled && scene) {
      const world = readCanvasPoint(event.clientX, event.clientY)
      if (world) {
        const marker = hitTestMarker(scene, world.x, world.y)
        if (marker) {
          dragRef.current = null
          markerMoveRef.current = {
            marker,
            moved: false,
            offsetX: world.x - marker.col * scene.tileSize,
            offsetY: world.y - marker.row * scene.tileSize,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          return
        }
      }
    }

    dragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startOffsetX: camera.offsetX,
      startOffsetY: camera.offsetY,
      startX: event.clientX,
      startY: event.clientY,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (markerMoveRef.current && scene) {
      if (markerMoveRef.current.pointerId !== event.pointerId) {
        return
      }

      const world = readCanvasPoint(event.clientX, event.clientY)
      if (!world) {
        return
      }

      const deltaX = event.clientX - markerMoveRef.current.startX
      const deltaY = event.clientY - markerMoveRef.current.startY
      const moved = Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2
      markerMoveRef.current = { ...markerMoveRef.current, moved }

      const maxCol = Math.max(
        Math.floor(scene.width / scene.tileSize) - markerMoveRef.current.marker.width,
        0,
      )
      const maxRow = Math.max(
        Math.floor(scene.height / scene.tileSize) - markerMoveRef.current.marker.height,
        0,
      )
      const nextCol = clamp(
        Math.round((world.x - markerMoveRef.current.offsetX) / scene.tileSize),
        0,
        maxCol,
      )
      const nextRow = clamp(
        Math.round((world.y - markerMoveRef.current.offsetY) / scene.tileSize),
        0,
        maxRow,
      )

      onMoveSceneMarker(markerMoveRef.current.marker.nodeId, nextCol, nextRow)
      setLayoutPreview(null)
      return
    }

    if (!camera || !dragRef.current) {
      updateHover(event.clientX, event.clientY)
      return
    }

    if (dragRef.current.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY
    const moved = Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2

    dragRef.current = {
      ...dragRef.current,
      moved,
    }

    if (!moved) {
      updateHover(event.clientX, event.clientY)
      return
    }

    setCamera({
      ...camera,
      offsetX: dragRef.current.startOffsetX + deltaX,
      offsetY: dragRef.current.startOffsetY + deltaY,
    })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const markerMove = markerMoveRef.current
    markerMoveRef.current = null
    if (markerMove && markerMove.pointerId === event.pointerId) {
      if (!markerMove.moved) {
        onSelectNode(markerMove.marker.nodeId)
      }
      return
    }

    const drag = dragRef.current
    dragRef.current = null

    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    if (drag.moved) {
      return
    }

    if (!scene || !camera) {
      onSelectNode(null)
      return
    }

    const world = readCanvasPoint(event.clientX, event.clientY)
    if (editorEnabled && world) {
      if (selectedPrefabId === 'erase') {
        const item = hitTestLayoutItem(layoutItems, world.x, world.y, scene.tileSize)
        if (item) {
          onRemoveLayoutItem(item.id)
          return
        }
      } else {
        const prefab = getLayoutPrefabDefinition(selectedPrefabId)
        const maxCol = Math.max(Math.floor(scene.width / scene.tileSize) - prefab.width, 0)
        const maxRow = Math.max(Math.floor(scene.height / scene.tileSize) - prefab.height, 0)
        onPlaceLayoutItem(
          selectedPrefabId,
          clamp(Math.floor(world.x / scene.tileSize), 0, maxCol),
          clamp(Math.floor(world.y / scene.tileSize), 0, maxRow),
        )
        return
      }
    }

    const marker = world ? hitTestMarker(scene, world.x, world.y) : null
    onSelectNode(marker?.nodeId ?? null)
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (!scene || !camera) {
      return
    }

    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const world = screenToWorld(camera, cursorX, cursorY)
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9
    const nextScale = clamp(camera.scale * zoomFactor, 0.35, 6)

    setCamera({
      offsetX: cursorX - world.x * nextScale,
      offsetY: cursorY - world.y * nextScale,
      scale: nextScale,
    })
  }

  return (
    <section className="graph-frame">
      <div className="graph-frame__header">
        <div>
          <p className="canvas-kicker">Tile Render</p>
          <strong>{scene ? `Floor ${scene.floorId}` : 'No map loaded'}</strong>
        </div>
        <p className="canvas-hint">
          {editorEnabled
            ? 'Edit mode: drag existing buildings or facilities to new grid positions.'
            : 'Drag to pan, wheel to zoom, click facilities or rooms to inspect them.'}
        </p>
      </div>

      <div className="graph-canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="graph-canvas"
          onMouseLeave={() => {
            setHoveredNodeId(null)
            setLayoutPreview(null)
            onHoverNode(null)
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        />

        {!scene ? (
          <div className="empty-canvas">
            <strong>No graph loaded</strong>
            <p>Load a JSON file to generate a pixel-style indoor navigation map.</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function hitTestLayoutItem(
  items: ManualLayoutItem[],
  worldX: number,
  worldY: number,
  tileSize: number,
): ManualLayoutItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    const left = item.col * tileSize
    const top = item.row * tileSize
    const width = item.width * tileSize
    const height = item.height * tileSize

    if (worldX >= left && worldX <= left + width && worldY >= top && worldY <= top + height) {
      return item
    }
  }

  return null
}
