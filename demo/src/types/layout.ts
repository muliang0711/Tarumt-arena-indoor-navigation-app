export type LayoutPrefabId =
  | 'barrel'
  | 'crate'
  | 'erase'
  | 'gate'
  | 'house_1'
  | 'house_2'
  | 'house_3'
  | 'tree_1'
  | 'tree_2'
  | 'wall'

export interface ManualLayoutItem {
  col: number
  floorId: number
  height: number
  id: string
  prefabId: Exclude<LayoutPrefabId, 'erase'>
  row: number
  width: number
}

export interface SceneMarkerOverride {
  col: number
  floorId: number
  nodeId: string
  row: number
}
