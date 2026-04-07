import { MAP_PALETTE, getNodeRenderStyle } from './mapTheme'
import { getLayoutPrefabDefinition, resolveLayoutPrefabSprite } from './manualLayoutCatalog'
import type { SampleSpriteSet, SpriteAsset } from './sampleSpriteCatalog'
import type { LayoutPrefabId, ManualLayoutItem } from '../types/layout'
import type { SceneData, SceneMarker, SceneRoute, SceneTile } from '../types/scene'

export interface CanvasCamera {
  offsetX: number
  offsetY: number
  scale: number
}

export interface RenderOptions {
  hoveredNodeId: string | null
  layoutItems: ManualLayoutItem[]
  layoutPreview: { col: number; row: number } | null
  renderMode: 'debug' | 'presentation'
  selectedNodeId: string | null
  selectedPrefabId: LayoutPrefabId
  showLabels: boolean
  sprites: SampleSpriteSet | null
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  camera: CanvasCamera,
  viewportWidth: number,
  viewportHeight: number,
  options: RenderOptions,
): void {
  ctx.save()
  ctx.clearRect(0, 0, viewportWidth, viewportHeight)
  ctx.fillStyle = MAP_PALETTE.background
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  drawBackdrop(ctx, viewportWidth, viewportHeight, options.sprites)

  ctx.translate(camera.offsetX, camera.offsetY)
  ctx.scale(camera.scale, camera.scale)
  ctx.imageSmoothingEnabled = false

  drawWorldPanel(ctx, scene, options.sprites)
  drawTiles(ctx, scene, options.sprites)
  drawBoundaryDecorations(ctx, scene, options.sprites)
  drawManualLayout(ctx, scene, options.layoutItems, options.sprites)
  drawMarkers(ctx, scene, options)
  drawAmbientProps(ctx, scene, options.sprites)
  drawLayoutPreview(ctx, scene, options.layoutPreview, options.selectedPrefabId, options.sprites)

  if (options.renderMode === 'debug') {
    drawDebugOverlay(ctx, scene)
  }

  ctx.restore()
}

export function fitCameraToScene(
  scene: SceneData,
  viewportWidth: number,
  viewportHeight: number,
): CanvasCamera {
  const padding = 48
  const scale = Math.min(
    (viewportWidth - padding * 2) / scene.width,
    (viewportHeight - padding * 2) / scene.height,
  )

  const nextScale = clamp(scale, 0.4, 3.2)
  const offsetX = Math.round((viewportWidth - scene.width * nextScale) / 2)
  const offsetY = Math.round((viewportHeight - scene.height * nextScale) / 2)

  return {
    offsetX,
    offsetY,
    scale: nextScale,
  }
}

export function screenToWorld(
  camera: CanvasCamera,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: (x - camera.offsetX) / camera.scale,
    y: (y - camera.offsetY) / camera.scale,
  }
}

export function hitTestMarker(
  scene: SceneData,
  worldX: number,
  worldY: number,
): SceneMarker | null {
  const tileSize = scene.tileSize

  for (let index = scene.markers.length - 1; index >= 0; index -= 1) {
    const marker = scene.markers[index]
    const left = marker.col * tileSize
    const top = marker.row * tileSize
    const width = marker.width * tileSize
    const height = marker.height * tileSize

    if (
      worldX >= left &&
      worldX <= left + width &&
      worldY >= top &&
      worldY <= top + height
    ) {
      return marker
    }
  }

  return null
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  sprites: SampleSpriteSet | null,
): void {
  const gradient = ctx.createLinearGradient(0, 0, viewportWidth, viewportHeight)
  gradient.addColorStop(0, '#152131')
  gradient.addColorStop(1, '#091018')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  if (sprites) {
    ctx.globalAlpha = 0.14
    tileFill(ctx, sprites.grass, 24, 24, viewportWidth - 48, viewportHeight - 48, 26)
    ctx.globalAlpha = 1
    return
  }

  ctx.fillStyle = 'rgba(123, 165, 255, 0.07)'
  ctx.fillRect(24, 24, viewportWidth - 48, viewportHeight - 48)
}

function drawWorldPanel(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  sprites: SampleSpriteSet | null,
): void {
  ctx.fillStyle = MAP_PALETTE.wall
  ctx.fillRect(-24, -24, scene.width + 48, scene.height + 48)

  if (!sprites) {
    ctx.fillStyle = MAP_PALETTE.floor
    ctx.fillRect(0, 0, scene.width, scene.height)

    const tile = scene.tileSize
    for (let y = 0; y < scene.height; y += tile) {
      for (let x = 0; x < scene.width; x += tile) {
        ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? MAP_PALETTE.floor : MAP_PALETTE.floorAccent
        ctx.fillRect(x, y, tile, tile)
      }
    }
    return
  }

  const tile = scene.tileSize
  for (let row = 0; row < Math.ceil(scene.height / tile); row += 1) {
    for (let col = 0; col < Math.ceil(scene.width / tile); col += 1) {
      const x = col * tile
      const y = row * tile
      const groundSprite = pickGroundSprite(sprites, col, row)
      drawSpriteCover(ctx, groundSprite, x, y, tile, tile)
    }
  }
}

function drawTiles(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  sprites: SampleSpriteSet | null,
): void {
  for (const tile of scene.tiles) {
    drawCorridorTile(ctx, tile, scene, sprites)
  }
}

function drawCorridorTile(
  ctx: CanvasRenderingContext2D,
  tile: SceneTile,
  scene: SceneData,
  sprites: SampleSpriteSet | null,
): void {
  const size = scene.tileSize
  const x = tile.col * size
  const y = tile.row * size
  const fill = tile.kind === 'junction' ? MAP_PALETTE.junction : MAP_PALETTE.corridor

  ctx.fillStyle = fill
  ctx.fillRect(x, y, size, size)

  if (sprites) {
    drawSpriteCover(
      ctx,
      tile.kind === 'junction' ? sprites.dirt : sprites.pavement,
      x,
      y,
      size,
      size,
    )
  }

  const top = scene.tileLookup.has(tileKey(tile.col, tile.row - 1))
  const bottom = scene.tileLookup.has(tileKey(tile.col, tile.row + 1))
  const left = scene.tileLookup.has(tileKey(tile.col - 1, tile.row))
  const right = scene.tileLookup.has(tileKey(tile.col + 1, tile.row))

  ctx.fillStyle = tile.kind === 'junction' ? MAP_PALETTE.junctionAccent : MAP_PALETTE.corridorEdge
  if (!top) {
    ctx.fillRect(x, y, size, 2)
  }
  if (!left) {
    ctx.fillRect(x, y, 2, size)
  }

  ctx.fillStyle = MAP_PALETTE.corridorShadow
  if (!bottom) {
    ctx.fillRect(x, y + size - 2, size, 2)
  }
  if (!right) {
    ctx.fillRect(x + size - 2, y, 2, size)
  }

  if (tile.kind === 'junction') {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8)
  }
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  options: RenderOptions,
): void {
  for (const route of scene.routes) {
    if (options.selectedNodeId && routeTouchesNode(route, options.selectedNodeId)) {
      drawRouteHighlight(ctx, route, scene.tileSize)
    }
  }

  for (const marker of scene.markers) {
    drawMarker(ctx, marker, scene.tileSize, options)
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  marker: SceneMarker,
  tileSize: number,
  options: RenderOptions,
): void {
  const style = getNodeRenderStyle(marker.type)
  const x = marker.col * tileSize
  const y = marker.row * tileSize
  const width = marker.width * tileSize
  const height = marker.height * tileSize
  const isHovered = options.hoveredNodeId === marker.nodeId
  const isSelected = options.selectedNodeId === marker.nodeId
  const alpha = marker.enabled ? 1 : 0.45

  ctx.save()
  ctx.globalAlpha = alpha

  drawMarkerConnector(ctx, marker, tileSize, options.sprites)

  if (options.sprites) {
    drawSpriteMarker(ctx, marker, x, y, width, height, tileSize, options.sprites, style)
  } else {
    ctx.fillStyle = '#0f1722'
    ctx.fillRect(x - 2, y - 2, width + 4, height + 4)
    ctx.fillStyle = style.fill
    ctx.fillRect(x, y, width, height)
    ctx.fillStyle = style.outline
    ctx.fillRect(x, y, width, 2)
    ctx.fillRect(x, y, 2, height)
    ctx.fillStyle = '#09111a'
    ctx.fillRect(x, y + height - 2, width, 2)
    ctx.fillRect(x + width - 2, y, 2, height)

    if (marker.type === 'room') {
      drawRoomMarker(ctx, marker, x, y, width, height, tileSize, style.accent)
    } else {
      drawFacilityMarker(ctx, marker, x, y, width, height, style.accent, style.code)
    }
  }

  if (isHovered || isSelected) {
    ctx.strokeStyle = isSelected ? MAP_PALETTE.highlight : '#ffffff'
    ctx.lineWidth = 3
    ctx.strokeRect(x - 3, y - 3, width + 6, height + 6)
  }

  if (options.showLabels) {
    const label = marker.name ?? (marker.type === 'room' ? marker.nodeId : null)
    if (label) {
      drawLabel(ctx, label, x + width / 2, y + height + 12, tileSize)
    }
  }

  ctx.restore()
}

function drawSpriteMarker(
  ctx: CanvasRenderingContext2D,
  marker: SceneMarker,
  x: number,
  y: number,
  width: number,
  height: number,
  tileSize: number,
  sprites: SampleSpriteSet,
  style: ReturnType<typeof getNodeRenderStyle>,
): void {
  const sprite = pickMarkerSprite(marker, sprites)

  ctx.fillStyle = 'rgba(6, 12, 16, 0.4)'
  ctx.fillRect(x + 4, y + height - Math.max(Math.floor(tileSize * 0.8), 8), width - 8, Math.max(Math.floor(tileSize * 0.55), 6))
  drawSpriteBottomContained(ctx, sprite, x, y, width, height)

  if (marker.type !== 'room' && marker.type !== 'entrance' && marker.type !== 'exit') {
    const badgeWidth = Math.max(Math.floor(width * 0.34), 18)
    const badgeHeight = Math.max(Math.floor(tileSize * 1.1), 14)
    const badgeX = x + width - badgeWidth - 4
    const badgeY = y + 4

    ctx.fillStyle = '#081018'
    ctx.fillRect(badgeX - 2, badgeY - 2, badgeWidth + 4, badgeHeight + 4)
    ctx.fillStyle = style.accent
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight)
    ctx.fillStyle = '#081018'
    ctx.font = `bold ${Math.max(Math.floor(tileSize * 0.62), 10)}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(style.code, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1)
  }
}

function drawMarkerConnector(
  ctx: CanvasRenderingContext2D,
  marker: SceneMarker,
  tileSize: number,
  sprites: SampleSpriteSet | null,
): void {
  const anchorX = marker.anchorCol * tileSize
  const anchorY = marker.anchorRow * tileSize
  const bodyX = marker.col * tileSize
  const bodyY = marker.row * tileSize
  const bodyWidth = marker.width * tileSize
  const bodyHeight = marker.height * tileSize
  let corridorX = anchorX
  let corridorY = anchorY
  let corridorWidth = tileSize
  let corridorHeight = tileSize

  if (marker.side === 'left') {
    corridorX = bodyX + bodyWidth - tileSize
    corridorWidth = anchorX - corridorX + tileSize
    corridorHeight = tileSize
    corridorY = anchorY
  } else if (marker.side === 'right') {
    corridorX = bodyX
    corridorWidth = bodyX - anchorX + tileSize
    corridorHeight = tileSize
    corridorY = anchorY
  } else if (marker.side === 'up') {
    corridorY = bodyY + bodyHeight - tileSize
    corridorHeight = anchorY - corridorY + tileSize
    corridorWidth = tileSize
    corridorX = anchorX
  } else {
    corridorY = bodyY
    corridorHeight = bodyY - anchorY + tileSize
    corridorWidth = tileSize
    corridorX = anchorX
  }

  ctx.fillStyle = '#0d1b25'
  ctx.fillRect(corridorX, corridorY, corridorWidth, corridorHeight)

  if (sprites) {
    tileFill(ctx, sprites.pavement, corridorX, corridorY, corridorWidth, corridorHeight, tileSize)
  } else {
    ctx.fillStyle = MAP_PALETTE.corridor
    ctx.fillRect(corridorX, corridorY, corridorWidth, corridorHeight)
  }
}

function drawRoomMarker(
  ctx: CanvasRenderingContext2D,
  marker: SceneMarker,
  x: number,
  y: number,
  width: number,
  height: number,
  tileSize: number,
  accent: string,
): void {
  ctx.fillStyle = accent
  ctx.fillRect(x + 4, y + 4, width - 8, 4)
  ctx.fillRect(x + 4, y + 12, width - 8, height - 20)

  const doorWidth = tileSize
  const doorHeight = 4
  const anchorX = marker.anchorCol * tileSize + tileSize / 2
  const anchorY = marker.anchorRow * tileSize + tileSize / 2

  ctx.fillStyle = '#f7edd3'
  if (marker.side === 'up') {
    ctx.fillRect(anchorX - doorWidth / 2, y + height - doorHeight, doorWidth, doorHeight)
  } else if (marker.side === 'down') {
    ctx.fillRect(anchorX - doorWidth / 2, y, doorWidth, doorHeight)
  } else if (marker.side === 'left') {
    ctx.fillRect(x + width - doorHeight, anchorY - doorWidth / 2, doorHeight, doorWidth)
  } else {
    ctx.fillRect(x, anchorY - doorWidth / 2, doorHeight, doorWidth)
  }
}

function drawFacilityMarker(
  ctx: CanvasRenderingContext2D,
  marker: SceneMarker,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  code: string,
): void {
  ctx.fillStyle = accent
  ctx.fillRect(x + 4, y + 4, width - 8, height - 8)

  ctx.fillStyle = '#081018'
  ctx.font = `bold ${Math.max(Math.floor(height * 0.24), 10)}px "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(code, x + width / 2, y + height / 2 + 1)

  if (marker.type === 'stairs') {
    ctx.fillStyle = '#081018'
    ctx.fillRect(x + 6, y + height - 9, width - 12, 2)
    ctx.fillRect(x + 10, y + height - 13, width - 16, 2)
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  centerX: number,
  topY: number,
  tileSize: number,
): void {
  ctx.font = `bold ${Math.max(Math.round(tileSize * 0.62), 10)}px "Courier New", monospace`
  const width = ctx.measureText(label).width
  const paddingX = 8
  const paddingY = 5
  const x = centerX - width / 2 - paddingX
  const y = topY

  ctx.fillStyle = MAP_PALETTE.labelShadow
  ctx.fillRect(x, y, width + paddingX * 2, tileSize)
  ctx.fillStyle = 'rgba(250, 253, 255, 0.95)'
  ctx.fillRect(x, y, width + paddingX * 2, 2)

  ctx.fillStyle = MAP_PALETTE.label
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(label, centerX, y + paddingY)
}

function drawRouteHighlight(
  ctx: CanvasRenderingContext2D,
  route: SceneRoute,
  tileSize: number,
): void {
  ctx.fillStyle = 'rgba(137, 240, 205, 0.24)'
  for (const tile of route.tiles) {
    ctx.fillRect(tile.col * tileSize + 3, tile.row * tileSize + 3, tileSize - 6, tileSize - 6)
  }
}

function drawBoundaryDecorations(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  sprites: SampleSpriteSet | null,
): void {
  if (!sprites) {
    return
  }

  const step = scene.tileSize * 3

  for (let x = 0; x < scene.width; x += step) {
    drawSpriteContained(ctx, sprites.wall, x, -18, scene.tileSize * 3, scene.tileSize * 3)
    drawSpriteContained(ctx, sprites.wall, x, scene.height - scene.tileSize * 2, scene.tileSize * 3, scene.tileSize * 3)
  }

  for (let y = scene.tileSize; y < scene.height - scene.tileSize * 2; y += step) {
    drawSpriteContained(ctx, sprites.wall, -10, y, scene.tileSize * 3, scene.tileSize * 3)
    drawSpriteContained(ctx, sprites.wall, scene.width - scene.tileSize * 2, y, scene.tileSize * 3, scene.tileSize * 3)
  }
}

function drawAmbientProps(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  sprites: SampleSpriteSet | null,
): void {
  if (!sprites) {
    return
  }

  const occupied = new Set<string>()
  for (const tile of scene.tiles) {
    occupied.add(tileKey(tile.col, tile.row))
  }
  for (const marker of scene.markers) {
    for (let row = marker.row; row < marker.row + marker.height; row += 1) {
      for (let col = marker.col; col < marker.col + marker.width; col += 1) {
        occupied.add(tileKey(col, row))
      }
    }
  }

  const maxCols = Math.floor(scene.width / scene.tileSize)
  const maxRows = Math.floor(scene.height / scene.tileSize)

  for (let row = 1; row < maxRows - 1; row += 1) {
    for (let col = 1; col < maxCols - 1; col += 1) {
      if (occupied.has(tileKey(col, row))) {
        continue
      }

      const seed = hashPoint(col, row, scene.floorId)
      if (seed % 41 === 0) {
        drawSpriteContained(
          ctx,
          sprites.trees[seed % sprites.trees.length],
          col * scene.tileSize - scene.tileSize / 2,
          row * scene.tileSize - scene.tileSize,
          scene.tileSize * 3,
          scene.tileSize * 3,
        )
      } else if (seed % 67 === 0) {
        drawSpriteContained(
          ctx,
          seed % 2 === 0 ? sprites.barrel : sprites.crate,
          col * scene.tileSize,
          row * scene.tileSize,
          scene.tileSize * 2,
          scene.tileSize * 2,
        )
      }
    }
  }
}

function drawManualLayout(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  items: ManualLayoutItem[],
  sprites: SampleSpriteSet | null,
): void {
  if (!sprites) {
    return
  }

  for (const item of items) {
    const sprite = resolveLayoutPrefabSprite(sprites, item.prefabId)
    const x = item.col * scene.tileSize
    const y = item.row * scene.tileSize
    const width = item.width * scene.tileSize
    const height = item.height * scene.tileSize

    ctx.fillStyle = 'rgba(6, 12, 16, 0.35)'
    ctx.fillRect(
      x + 3,
      y + height - Math.max(Math.floor(scene.tileSize * 0.85), 8),
      width - 6,
      Math.max(Math.floor(scene.tileSize * 0.6), 6),
    )
    drawSpriteBottomContained(ctx, sprite, x, y, width, height)
  }
}

function drawLayoutPreview(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  preview: { col: number; row: number } | null,
  selectedPrefabId: LayoutPrefabId,
  sprites: SampleSpriteSet | null,
): void {
  if (!preview || !sprites || selectedPrefabId === 'erase') {
    return
  }

  const prefab = getLayoutPrefabDefinition(selectedPrefabId)
  const sprite = resolveLayoutPrefabSprite(sprites, selectedPrefabId)
  const maxCol = Math.max(Math.floor(scene.width / scene.tileSize) - prefab.width, 0)
  const maxRow = Math.max(Math.floor(scene.height / scene.tileSize) - prefab.height, 0)
  const col = clamp(preview.col, 0, maxCol)
  const row = clamp(preview.row, 0, maxRow)
  const x = col * scene.tileSize
  const y = row * scene.tileSize
  const width = prefab.width * scene.tileSize
  const height = prefab.height * scene.tileSize

  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.fillStyle = 'rgba(137, 240, 205, 0.22)'
  ctx.fillRect(x, y, width, height)
  drawSpriteBottomContained(ctx, sprite, x, y, width, height)
  ctx.strokeStyle = MAP_PALETTE.highlight
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2)
  ctx.restore()
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, scene: SceneData): void {
  ctx.strokeStyle = 'rgba(120, 236, 255, 0.75)'
  ctx.lineWidth = 2

  for (const route of scene.routes) {
    if (route.points.length < 2) {
      continue
    }

    ctx.beginPath()
    route.points.forEach((point, index) => {
      const x = point.col * scene.tileSize + scene.tileSize / 2
      const y = point.row * scene.tileSize + scene.tileSize / 2
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255, 95, 95, 0.9)'
  ctx.font = '10px "Courier New", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  for (const anchor of scene.anchors) {
    const x = anchor.col * scene.tileSize + 4
    const y = anchor.row * scene.tileSize + 4
    ctx.fillRect(x, y, 8, 8)
    ctx.fillText(anchor.node.node_id, x + 10, y - 2)
  }
}

function routeTouchesNode(route: SceneRoute, nodeId: string): boolean {
  return route.fromNode === nodeId || route.toNode === nodeId
}

function pickGroundSprite(
  sprites: SampleSpriteSet,
  col: number,
  row: number,
): SpriteAsset {
  return hashPoint(col, row, 17) % 7 === 0 ? sprites.dirt : sprites.grass
}

function pickMarkerSprite(marker: SceneMarker, sprites: SampleSpriteSet): SpriteAsset {
  if (marker.type === 'entrance' || marker.type === 'exit') {
    return sprites.gate
  }

  if (marker.type === 'room') {
    return sprites.houses[hashString(marker.nodeId) % sprites.houses.length]
  }

  if (marker.type === 'stairs') {
    return sprites.houses[1]
  }

  if (marker.type === 'toilet') {
    return sprites.houses[2]
  }

  if (marker.type === 'elevator') {
    return sprites.houses[0]
  }

  return sprites.houses[hashString(marker.type) % sprites.houses.length]
}

function drawSpriteCover(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.drawImage(sprite.image, x, y, width, height)
}

function drawSpriteContained(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / sprite.image.width, height / sprite.image.height)
  const drawWidth = Math.max(Math.round(sprite.image.width * scale), 1)
  const drawHeight = Math.max(Math.round(sprite.image.height * scale), 1)
  const drawX = x + Math.floor((width - drawWidth) / 2)
  const drawY = y + Math.floor((height - drawHeight) / 2)

  ctx.drawImage(sprite.image, drawX, drawY, drawWidth, drawHeight)
}

function drawSpriteBottomContained(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / sprite.image.width, height / sprite.image.height)
  const drawWidth = Math.max(Math.round(sprite.image.width * scale), 1)
  const drawHeight = Math.max(Math.round(sprite.image.height * scale), 1)
  const drawX = x + Math.floor((width - drawWidth) / 2)
  const drawY = y + height - drawHeight

  ctx.drawImage(sprite.image, drawX, drawY, drawWidth, drawHeight)
}

function tileFill(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  x: number,
  y: number,
  width: number,
  height: number,
  tileSize: number,
): void {
  for (let nextY = y; nextY < y + height; nextY += tileSize) {
    for (let nextX = x; nextX < x + width; nextX += tileSize) {
      const drawWidth = Math.min(tileSize, x + width - nextX)
      const drawHeight = Math.min(tileSize, y + height - nextY)
      ctx.drawImage(sprite.image, nextX, nextY, drawWidth, drawHeight)
    }
  }
}

function hashPoint(col: number, row: number, salt: number): number {
  return hashString(`${col}:${row}:${salt}`)
}

function hashString(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function tileKey(col: number, row: number): string {
  return `${col},${row}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
