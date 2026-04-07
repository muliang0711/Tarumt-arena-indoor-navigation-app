import type { SampleSpriteSet, SpriteAsset } from './sampleSpriteCatalog'
import type { LayoutPrefabId } from '../types/layout'

export interface LayoutPrefabDefinition {
  height: number
  id: LayoutPrefabId
  kind: 'erase' | 'structure'
  label: string
  width: number
}

const PREFABS: LayoutPrefabDefinition[] = [
  { height: 6, id: 'house_1', kind: 'structure', label: 'House A', width: 8 },
  { height: 9, id: 'house_2', kind: 'structure', label: 'House B', width: 6 },
  { height: 6, id: 'house_3', kind: 'structure', label: 'House C', width: 4 },
  { height: 3, id: 'tree_1', kind: 'structure', label: 'Tree A', width: 3 },
  { height: 2, id: 'tree_2', kind: 'structure', label: 'Tree B', width: 2 },
  { height: 2, id: 'crate', kind: 'structure', label: 'Crate', width: 2 },
  { height: 2, id: 'barrel', kind: 'structure', label: 'Barrel', width: 2 },
  { height: 4, id: 'gate', kind: 'structure', label: 'Gate', width: 4 },
  { height: 3, id: 'wall', kind: 'structure', label: 'Wall Segment', width: 3 },
  { height: 1, id: 'erase', kind: 'erase', label: 'Erase', width: 1 },
]

export function getLayoutPrefabCatalog(): LayoutPrefabDefinition[] {
  return PREFABS
}

export function getLayoutPrefabDefinition(prefabId: LayoutPrefabId): LayoutPrefabDefinition {
  const prefab = PREFABS.find((entry) => entry.id === prefabId)

  if (!prefab) {
    throw new Error(`Unknown prefab "${prefabId}".`)
  }

  return prefab
}

export function resolveLayoutPrefabSprite(
  sprites: SampleSpriteSet,
  prefabId: Exclude<LayoutPrefabId, 'erase'>,
): SpriteAsset {
  if (prefabId === 'house_1') {
    return sprites.houses[0]
  }

  if (prefabId === 'house_2') {
    return sprites.houses[1]
  }

  if (prefabId === 'house_3') {
    return sprites.houses[2]
  }

  if (prefabId === 'tree_1') {
    return sprites.trees[0]
  }

  if (prefabId === 'tree_2') {
    return sprites.trees[1]
  }

  if (prefabId === 'crate') {
    return sprites.crate
  }

  if (prefabId === 'barrel') {
    return sprites.barrel
  }

  if (prefabId === 'gate') {
    return sprites.gate
  }

  return sprites.wall
}
