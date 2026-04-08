# Tilemap、Layer 与运行时 Dataflow

## 目标

这份文档把前面对话里最关键的基础知识整理成一份可复读的课程笔记，重点回答这几个问题：

1. `Tileset` 到底是什么
2. `Tilemap` 到底是什么
3. `Layer` 到底存在哪里
4. 地图、角色、碰撞、渲染之间的数据流到底怎么走
5. 为什么角色移动通常不会直接修改 `Tilemap`

---

## 一句话总览

如果先只记一件事，就记这个：

`Tileset = 资源`

`Tilemap = 地图摆放数据`

`Layer = 地图里的分层数据`

`Entity = 地图里的动态对象，比如玩家/NPC`

`Runtime State = 当前这一刻的动态状态`

`Renderer = 把 Tilemap + Entity + Camera + UI 一起画出来`

---

## 1. Tileset 是什么

`Tileset` 是一组可重复使用的小图块资源。

常见例子：

- 草地
- 墙
- 树
- 桌子
- 门
- 楼梯
- 地砖

这些资源通常会以两种方式存在：

1. 一张大图，里面切成很多小格
2. 多个单独的小 PNG

在 tilemap 工作流里，`Tileset` 是素材库，不是地图本身。

---

## 2. Tilemap 是什么

`Tilemap` 是地图数据，而不是地图图片。

它描述的是：

- 地图宽高
- 每格用哪个 tile
- 哪些地方能走
- 哪些地方不能走
- 哪些地方有物件
- 哪些地方需要前景遮挡
- 哪些位置是事件点或出生点

它可以存成 JSON，也可以存成别的格式；但 JSON 是最好理解、最好调试的一种。

你可以把它理解成：

`Tilemap = 地图施工图`

程序运行时不是直接“看图”，而是“读施工图，然后把画面画出来”。

---

## 3. Layer 到底是什么

`Layer` 不是 folder，不是文件夹分类，也不是随便分组。

`Layer` 是地图在渲染和逻辑上的分层。

最常见的几层：

- `ground`
  - 地板、道路、地砖、草地
- `objects`
  - 树、桌子、石头、墙体装饰
- `collision`
  - 能不能走的逻辑层
- `foreground`
  - 会挡住角色的屋檐、树冠、顶部装饰
- `events`
  - 门、传送点、NPC 点位、触发点

### 为什么必须有 Layer

因为同一个格子上，可能同时存在：

- 地板
- 桌子
- 角色
- 屋檐

这些东西不可能全部在同一层里处理，不然渲染顺序会乱掉。

例如：

1. 先画地板
2. 再画桌子
3. 再画角色
4. 最后画屋檐

这样角色才会出现：

- 有时在物件前面
- 有时被屋檐盖住上半身

---

## 4. Layer 存在哪里

通常就是存在 `Tilemap` 里面。

也就是说，`Tilemap` 往往长这样：

```json
{
  "mapId": "village_01",
  "width": 5,
  "height": 4,
  "tileSize": 32,
  "tilesetId": "main",
  "layers": [
    { "id": "ground", "type": "tile", "data": [1,1,1,1,1,1,2,2,2,1,1,2,2,2,1,1,1,1,1,1] },
    { "id": "objects", "type": "tile", "data": [0,0,0,0,0,0,0,5,0,0,0,0,6,0,0,0,0,0,0,0] },
    { "id": "collision", "type": "mask", "data": [1,1,1,1,1,1,0,1,0,1,1,0,1,0,1,1,1,1,1,1] },
    { "id": "foreground", "type": "tile", "data": [0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,0] }
  ]
}
```

所以：

- `Tilemap` 是总包
- `layers[]` 是里面的一层层数据

---

## 5. Tilemap 数据里的数字是什么意思

这些数字一般是 tile 编号。

例如：

```json
"data": [
  1, 1, 1, 1, 1,
  1, 2, 2, 2, 1,
  1, 2, 2, 2, 1,
  1, 1, 1, 1, 1
]
```

可以理解成：

```text
1 = 草地
2 = 泥土地
5 = 桌子
6 = 椅子
9 = 树冠或屋檐
0 = 空，不画
```

当地图宽度是 `5` 时，这个一维数组可以还原成二维格子：

```text
1 1 1 1 1
1 2 2 2 1
1 2 2 2 1
1 1 1 1 1
```

---

## 6. 运行时怎么读取 Layer

`Layer` 不会自己渲染。

是游戏运行时代码按顺序去读它。

最简单的伪代码：

```js
for (const layer of map.layers) {
  if (layer.type !== "tile") continue;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const index = y * map.width + x;
      const tileId = layer.data[index];

      if (tileId === 0) continue;

      const tileRect = getTileRectFromTileset(tileId);
      drawTile(tileRect, x * map.tileSize, y * map.tileSize);
    }
  }
}
```

意思就是：

1. 读某一层
2. 一格一格看它的数据
3. 查出 tile id
4. 去 tileset 找对应图片
5. 画到目标位置

---

## 7. Collision Layer 是怎么工作的

`collision` 层通常不负责“给玩家看”，它主要是给逻辑系统读。

例如：

```json
{
  "id": "collision",
  "type": "mask",
  "data": [
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1
  ]
}
```

可以约定：

- `1` = blocked，不能走
- `0` = walkable，可以走

角色移动时：

```js
const blocked = collisionLayer.data[nextY * width + nextX] === 1;
if (!blocked) {
  player.x = nextX;
  player.y = nextY;
}
```

所以 collision layer 更像“导航规则层”或“通行规则层”。

---

## 8. 角色移动时，到底改什么

这里最重要。

角色移动时，通常**不会去改 `Tilemap`**。

正常做法是：

- `Tilemap` 负责静态地图
- `Player State` 负责玩家当前的位置

例如：

```json
{
  "player": {
    "x": 5,
    "y": 3,
    "direction": "down"
  }
}
```

玩家按右键之后：

1. 先看目标格能不能走
2. 如果能走，就更新 `player.x`
3. 下一帧渲染时，把角色画到新的位置

不是每走一步都去改 `tilemap.json`。

### 为什么不改 Tilemap

因为：

- `Tilemap` 是世界结构
- `Player` 是世界里的实体

人移动，不会改变房间结构。

---

## 9. 真正的渲染输入是什么

游戏实际渲染时，不只是看 `Tilemap`。

它会同时看：

```text
Render Input =
  Tilemap
  + Entity State
  + Camera State
  + UI State
```

例如一帧画面可能是这样形成的：

1. 画 `ground`
2. 画 `objects`
3. 画 `player`
4. 画 `npc`
5. 画 `foreground`
6. 画 `ui`

---

## 10. 最小移动 Dataflow

```md
# 玩家移动 Dataflow

1. 玩家输入方向
   - left / right / up / down

2. 游戏逻辑计算目标位置
   - nextX
   - nextY

3. 查询 Tilemap 的 collision layer
   - 看目标格能不能走

4. 如果能走
   - 更新 player state
   - player.x = nextX
   - player.y = nextY

5. 进入下一帧渲染
   - 先画地图
   - 再画角色在新位置
   - 再画前景和 UI
```

---

## 11. 完整 2D Tilemap 游戏 Dataflow

```md
# 2D Tilemap 游戏完整 Dataflow

## A. 素材阶段
1. 美术准备 Tileset
   - grass
   - wall
   - table
   - tree
   - roof
   - road

2. 把这些小图组织成 tileset
   - 一张大图切块
   - 或多张独立 PNG

## B. 地图编辑阶段
3. 地图编辑器载入 tileset
4. 设计者切换 layer 摆地图
   - ground layer 放地板
   - objects layer 放家具/树/石头
   - collision layer 标可走/不可走
   - foreground layer 放屋檐/树冠

5. 编辑器输出 map.json
   - width
   - height
   - tileSize
   - tileset reference
   - layers[]
   - spawn points / events

## C. 游戏加载阶段
6. 游戏启动
7. 读取 map.json
8. 读取 tileset image
9. 在内存中构建 map object

## D. 逻辑阶段
10. 玩家输入移动
11. 先查 collision layer
12. 如果目标格可走，更新 player state
13. camera 跟随 player

## E. 渲染阶段
14. 每一帧按顺序渲染
   - render ground
   - render objects
   - render player / npc
   - render foreground
   - render UI
```

---

## 12. 什么时候才会修改 Tilemap

虽然玩家移动通常不改 Tilemap，但有些世界变化会改：

- 挖掉一块地板
- 放下一块建筑
- 打开永久改变状态的门
- 炸掉一面墙

例如：

1. `objects` 层里的门从 `closed_door` 改成 `open_door`
2. `collision` 层同时从 `blocked` 改成 `walkable`

这类修改属于“世界状态变化”，不是普通位移。

---

## 13. 对当前项目的映射

你现在项目里已经有一些很像 tilemap 系统的东西：

- `placements`
  - 更像 `objects layer`
- `metadataTiles`
  - 更像 `collision / walkable layer`
- `nodes + links`
  - 更像 `navigation / event layer`

当前还缺的主要是：

1. 一个真正稳定的 `ground layer`
2. 更统一的 `layers[]` 结构
3. 角色实体与地图分离的运行时模型
4. camera 跟随视角
5. 更标准的 tileset/tile id 映射方式

---

## 14. 最后要记住的模型

```text
Tileset = 图块资源
Tilemap = 静态场景数据
Layer = 场景里的分层数据
Entity = 动态对象
Movement = 更新实体位置
Collision = 用 Tilemap 判断能不能走
Renderer = 把地图和实体一起画出来
```

如果只记一句：

**地图决定世界长什么样，实体决定谁在世界里怎么动。**

