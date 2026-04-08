# MVP Runtime Package Schema v1

## 目标

这份文档定义当前项目最现实的 MVP 交付方式：

**让 `village_map_editor` 输出一个 Flutter runtime 可直接读取的地图包。**

这份规格不追求一开始就变成完整标准 tilemap，而是先满足这四件事：

1. Flutter 能正确读入地图数据
2. Flutter 能正确加载对应资源
3. Flutter 能把地图画出来
4. Flutter 能让一个最小 `player` 在地图中移动并与碰撞层互动

---

## 一句话结论

MVP 第一版不要急着把 editor 改造成“标准 RPG Tilemap 编辑器”。

先走这条路线：

`village_map_editor -> map package -> flutter runtime`

其中：

- `map package` = `map.json + resources folder`
- Flutter runtime 先读现有结构的过渡版 JSON
- 后续再慢慢演进成更标准的 `layers[]` 模型

---

## 1. MVP 的文件结构

建议先定义一个地图包目录，长这样：

```text
map_package/
  map.json
  preview.png
  resources/
    serious_shit/
      classroom_1.png
      elevator.png
      examroom_1.png
      meetingroom_1.png
      staris.png
      toilet.png
      unwalkable_tile_clean.png
      unwalkable_tile_dirt.png
      walkable_road_clean.png
      walkable_road_dirt.png
      white_greg_tile.png
      white_tile.png
```

### 每个文件负责什么

- `map.json`
  - 运行时真正读取的地图数据
- `preview.png`
  - 可选，给预览页或调试用
- `resources/serious_shit/*`
  - 运行时需要加载的 PNG 资源

---

## 2. 为什么资源要跟地图包一起走

因为当前地图里 `placements` 存的是资源引用，不是烘焙后的最终画面。

所以 runtime 要想真正重建场景，就必须同时拿到：

1. 地图 JSON
2. 资源图片

也就是说：

```text
Map JSON 负责“告诉你放什么”
Resources 负责“提供被放进去的图片”
```

---

## 3. MVP 的 JSON Schema v1

第一版先不要强迫自己上完整 `layers[]`，先基于现有 editor 的导出结构做一份清晰的过渡规格。

```json
{
  "schemaVersion": 1,
  "mapId": "village_demo_01",
  "tileSize": 16,
  "mapWidth": 30,
  "mapHeight": 20,
  "resourceRoot": "resources/serious_shit",
  "background": {
    "mode": "auto-tile",
    "walkableAssetId": "walkable_road_clean",
    "blockedAssetId": "unwalkable_tile_clean"
  },
  "visual": {
    "placements": [
      {
        "id": "placement_001",
        "assetId": "meetingroom_1",
        "x": 4,
        "y": 2
      }
    ]
  },
  "metadata": {
    "autoBlockFromVisuals": true,
    "tiles": [
      { "x": 0, "y": 0, "kind": "blocked" },
      { "x": 1, "y": 0, "kind": "walkable" }
    ],
    "resolvedTiles": [
      { "x": 0, "y": 0, "kind": "blocked" },
      { "x": 1, "y": 0, "kind": "walkable" }
    ]
  },
  "navigation": {
    "nodes": [
      {
        "id": "stairs_a",
        "label": "Stairs A",
        "type": "stairs",
        "x": 8,
        "y": 10
      }
    ],
    "links": [
      {
        "id": "link_001",
        "from": "stairs_a",
        "to": "toilet_a"
      }
    ]
  },
  "spawn": {
    "playerStart": {
      "x": 2,
      "y": 2,
      "direction": "down"
    }
  }
}
```

---

## 4. 这些字段各自负责什么

### 基础字段

- `schemaVersion`
  - 当前地图包版本
- `mapId`
  - 地图唯一 ID
- `tileSize`
  - 每格尺寸
- `mapWidth`
  - 地图格子宽度
- `mapHeight`
  - 地图格子高度

### 资源字段

- `resourceRoot`
  - 资源根目录

### 背景字段

- `background.mode`
  - MVP 先支持 `auto-tile`
- `walkableAssetId`
  - 默认可走背景 tile
- `blockedAssetId`
  - 默认不可走背景 tile

### 视觉层

- `visual.placements`
  - 现在 editor 已经有的物件摆放数据

### 元数据层

- `metadata.tiles`
  - 手动编辑的 metadata
- `metadata.resolvedTiles`
  - 最终运行时使用的碰撞/通行结果

### 导航层

- `navigation.nodes`
  - 路径图中的节点
- `navigation.links`
  - 节点连接关系

### 玩家出生点

- `spawn.playerStart`
  - Flutter runtime 启动时 player 的位置

---

## 5. 为什么这版 JSON 不急着做成标准 `layers[]`

因为你现在 editor 的现有数据结构已经是半成品了：

- `placements`
- `metadataTiles`
- `nodes`
- `links`

如果你现在硬把它全部重构成：

```json
"layers": [
  { "id": "ground", "type": "tile", "data": [...] },
  { "id": "objects", "type": "tile", "data": [...] },
  { "id": "collision", "type": "mask", "data": [...] }
]
```

会让 MVP 复杂度瞬间上升。

MVP 阶段更合理的策略是：

1. 先保留现在 editor 已经稳定产出的结构
2. 先让 runtime 跑起来
3. 后面再演进成正式 tilemap schema

---

## 6. Editor 当前字段和 MVP Schema 的映射

当前 `village_map_editor` 已经能导出这些字段：

```text
tileSize
mapWidth
mapHeight
visual.placements
metadata.tiles
metadata.resolvedTiles
nodes
links
```

所以映射关系如下：

```text
editor.tileSize -> map.tileSize
editor.mapWidth -> map.mapWidth
editor.mapHeight -> map.mapHeight
editor.visual.placements -> map.visual.placements
editor.metadata.tiles -> map.metadata.tiles
editor.metadata.resolvedTiles -> map.metadata.resolvedTiles
editor.nodes -> map.navigation.nodes
editor.links -> map.navigation.links
```

额外新增但当前 editor 还未正式输出的字段：

```text
schemaVersion
mapId
resourceRoot
background
spawn
```

这几个字段很适合在下一步 exporter 中补上。

---

## 7. Flutter Runtime 需要做什么

Flutter runtime 在 MVP 第一版至少要完成这些步骤：

```md
# Flutter Runtime Dataflow v1

1. 读取 map.json
2. parse 成 MapModel
3. 建立 assetId -> image path 的映射
4. 加载 resources/serious_shit/*
5. 根据 metadata.resolvedTiles 画背景
6. 根据 visual.placements 画物件
7. 根据 navigation.nodes / links 画 overlay
8. 根据 spawn.playerStart 创建 player
9. Movement System 根据 resolvedTiles 判断能不能走
10. Camera System 跟随 player
11. Render System 把背景、物件、player、overlay、UI 画出来
```

---

## 8. Flutter Runtime 的最小模块

MVP 第一版不需要一堆复杂模块，先有下面这些就够：

### Map Loader

负责：

- 读 `map.json`
- 校验字段
- 建立内存模型

### Resource Resolver

负责：

- 根据 `assetId` 找到对应 PNG

### Background Renderer

负责：

- 读 `metadata.resolvedTiles`
- 根据 `walkable` / `blocked` 选择对应背景 tile

### Placement Renderer

负责：

- 画 `visual.placements`

### Navigation Overlay Renderer

负责：

- 画节点
- 画连线
- 画选中的路径

### Player Entity

负责：

- 玩家位置
- 朝向
- 简单移动状态

### Movement System

负责：

- 查询目标格是否 blocked
- 更新 player position

### Camera System

负责：

- 决定当前 viewport 看哪里
- 跟随 player
- 保持可读缩放

### Render System

负责：

- 组合所有层，输出当前画面

---

## 9. MVP 第一版真正要支持的功能

先只做这四件事：

1. 加载 `map.json`
2. 加载 `resources/serious_shit`
3. 渲染背景 + placements + player
4. player 能在地图里移动并受碰撞限制

如果这四件事成立，就已经足够验证：

- 数据结构是不是对的
- 资源组织是不是对的
- Flutter runtime 是不是走得通
- 你的地图阅读性和视角方案有没有希望

---

## 10. 第一版暂时不要做什么

MVP 阶段先不要做：

1. 正式完整的多层标准 tilemap schema
2. 复杂 NPC AI
3. 完整门、传送、任务系统
4. 动态资源热更新平台
5. 丰富动画系统
6. 复杂 pathfinding runtime

这些都是第二阶段的事。

---

## 11. 未来怎么从 v1 演进到正式版

当 v1 跑通之后，可以这样升级：

### v2

把背景层显式化：

```json
"layers": {
  "ground": ...,
  "objects": ...
}
```

### v3

把 collision 和 events 正式分层：

```json
"layers": {
  "ground": ...,
  "objects": ...,
  "collision": ...,
  "foreground": ...,
  "events": ...
}
```

### v4

再考虑接入：

- `Flame`
- `flame_tiled`
- 更标准的 tile id 驱动模型

---

## 12. 最后结论

这份规格的核心原则是：

**先让 editor 当前能输出的东西，变成 runtime 真能吃的东西。**

不要一开始就追求“最标准、最优雅、最游戏引擎化”的 schema。

先跑通：

`editor output -> map package -> flutter runtime`

只要这条链跑通，你后面再升级成更标准的 tilemap 系统就会容易很多。

