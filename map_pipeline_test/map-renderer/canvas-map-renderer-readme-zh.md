# Canvas Map Renderer

这份 README 说明 Canvas 地图渲染系统的职责，以及这些 renderer 文件如何一起把 `mapData` 和 tileset 图片资源画成一张可看的 2D indoor map。

整体目标是：

```text
mapData + tileset 图片资源
        ↓
按正确顺序画到 Canvas
        ↓
得到一张可看的 2D indoor map
```

这一层不是 routing / pathfinding 系统，也不是 sensor movement 系统。

它主要负责地图渲染：

```text
背景
tile 图片
房间区域
collision debug
label / icon overlay
```

## 整体 Flow

```text
index.js
  ↓ 对外导出所有 renderer 工具

TileGrid.js
  ↓ 建立地图基础尺寸 + 画背景

LayerComposer.js
  ↓ 控制整个绘制顺序

TilesetRenderer.js
  ↓ 根据 visualLayers 把 tileset 图片画出来

RoomZones.js
  ↓ 可选：画房间边界 debug

CollisionLayer.js
  ↓ 可选：画不可走区域 debug

DisplayOverlay.js
  ↓ 可选：画 icon 和 label
```

简单讲：

```text
Canvas map renderer = 把 mapData 里面的视觉资料，按照正确图层顺序画到 Canvas 上
```

## index.js

`index.js` 是 renderer folder 的统一出口。

它自己不做渲染逻辑，只负责把其他 renderer 工具 export 出去。

例如：

```js
export { createTileGrid, drawMapBackground } from "./TileGrid.js";
export { TilesetRenderer } from "./TilesetRenderer.js";
export { drawCollisionLayer } from "./CollisionLayer.js";
export { drawDisplayOverlay } from "./DisplayOverlay.js";
export { drawRoomZones } from "./RoomZones.js";
export { LayerComposer, classifyAsset, getVisualBounds, orderVisualLayers } from "./LayerComposer.js";
```

这样其他地方只需要 import renderer folder，不需要一个一个找文件。

简单讲：

```text
index.js = renderer folder 的入口菜单
```

## TileGrid.js

`TileGrid.js` 负责地图最底层的尺寸和背景。

`createTileGrid(mapData)` 会从 `mapData` 里面取得：

```text
width
height
tileSize
worldWidth
worldHeight
```

例如：

```text
width = 70
height = 60
tileSize = 16

worldWidth = 70 × 16 = 1120
worldHeight = 60 × 16 = 960
```

`drawMapBackground(ctx, grid)` 负责先铺一层背景色：

```js
ctx.fillStyle = "#f5f4ef";
ctx.fillRect(0, 0, grid.worldWidth, grid.worldHeight);
```

这样可以避免 Canvas 是空白或透明底。

简单讲：

```text
TileGrid.js = 地图画布基础层
```

## TilesetRenderer.js

`TilesetRenderer.js` 是核心渲染器之一。

它负责把 tileset asset 真的画到 Canvas 上。

它主要依赖：

```text
mapData
assetBundle
```

`assetBundle` 通常包含：

```text
manifest = 每个 asset 的宽高资料
images   = 已经加载好的图片
missing  = 缺失资源记录
```

核心流程是：

```js
drawVisualLayers(ctx, visualLayers)
```

它会遍历 `visualLayers`，每个 placement 代表一个 asset 应该画在哪里。

例如：

```js
{
  id: "room_1",
  assetId: "classroom_01",
  x: 10,
  y: 5
}
```

然后把 tile 坐标转换成 pixel 坐标：

```text
x = placement.x × tileSize
y = placement.y × tileSize
```

如果 `tileSize = 16`：

```text
x = 10 tile → 160 px
y = 5 tile  → 80 px
```

最后通过 `ctx.drawImage()` 把图片画出来。

如果图片找不到，它会画一个粉红色 debug 方块。

这样你可以很快看出哪个 asset missing。

简单讲：

```text
TilesetRenderer.js = 把 mapData.visualLayers 变成真实图片
```

## LayerComposer.js

`LayerComposer.js` 是整个 renderer 的总控文件。

它决定：

```text
什么先画
什么后画
debug layer 要不要显示
overlay 要不要显示
```

核心 class 是：

```js
LayerComposer
```

初始化时，它通常会做几件事：

```text
1. 创建 TilesetRenderer
2. 把 visualLayers 排序
3. 计算整张地图的视觉边界
```

真正画图的是：

```js
render(ctx, options = {})
```

绘制顺序大概是：

```text
1. drawMapBackground
2. drawVisualLayers
3. drawRoomZones
4. drawCollisionLayer
5. drawDisplayOverlay
```

换成人话：

```text
先画背景
再画地板、房间、墙、门、装饰
如果打开 debug，画房间边界
如果打开 debug，画 collision 红色区域
最后画 icon 和 label
```

这个顺序很重要，因为 Canvas 是一层一层盖上去的。

如果先画 label，再画房间图片，label 会被后面的图片盖掉。

简单讲：

```text
LayerComposer.js = 控制整张地图的绘制顺序
```

## orderVisualLayers()

`orderVisualLayers()` 负责把 `visualLayers` 排成正确的绘制顺序。

目前的顺序可以理解成：

```text
FLOOR
ROOM
WALL_OBJECT
DOOR
DECORATION
UNKNOWN
```

也就是：

```text
地板先画
房间再画
墙上物件再画
门再画
装饰最后画
```

这样地板会在最底下，门和装饰会显示在上面。

它会通过 `classifyAsset(assetId)` 判断 asset 属于哪一类。

例如 assetId 像这些：

```text
road_01
walkable_01
floor_tile
```

就会被归类成 floor。

## stairs Typo 注意点

目前分类逻辑里如果有类似：

```js
if (/^(classroom|examroom|meetingroom|toilet|staris)/.test(assetId))
```

这里的 `staris` 很可能是 typo，应该是 `stairs`。

如果实际 assetId 是：

```text
stairs_01
```

它可能不会被分类成 ROOM，而是掉到 UNKNOWN。

这可能会影响绘制顺序。

之后建议把 `staris` 修成 `stairs`，或同时兼容两个写法。

## getVisualBounds()

`getVisualBounds()` 负责计算所有 visual asset 的整体范围。

它会遍历每个 placement，然后根据：

```text
placement.x
placement.y
tileSize
asset.widthPixels
asset.heightPixels
```

找出整张视觉地图的边界：

```text
minX
minY
maxX
maxY
```

最后得到：

```js
{
  x,
  y,
  width,
  height
}
```

这个结果通常可以用在：

```text
camera fit view
center map
计算地图实际可见范围
```

如果没有任何 `visualLayers`，它会直接返回整张 world size。

## CollisionLayer.js

`CollisionLayer.js` 负责画 collision debug layer。

入口通常是：

```js
drawCollisionLayer(ctx, mapData, options = {})
```

如果没有打开 visible，它就不会画。

打开后，它会遍历：

```text
mapData.collision
```

每个 collision cell 大概是：

```js
{ x: 10, y: 5 }
```

然后画红色半透明格子：

```text
x = cell.x × tileSize
y = cell.y × tileSize
```

它的意思是：

```text
这些格子不可走 / 有碰撞
```

注意：这个文件只是把 collision 画出来给你 debug。

它不负责真正阻止角色移动。

真正的 collision check 应该在 movement / collision logic 里面做。

简单讲：

```text
CollisionLayer.js = collision 可视化 debug
```

## RoomZones.js

`RoomZones.js` 负责画房间边界 debug。

它会遍历：

```text
mapData.movement.rooms
```

如果 room 有 `bounds`，就画蓝色边框。

这里要注意一个坐标单位问题：

```text
room.bounds 看起来已经是 pixel 坐标
```

因为它没有再乘 `tileSize`。

这和 collision 不一样：

```text
collision 用 tile 坐标
room.bounds 用 pixel 坐标
```

所以数据设计要保持清楚。

如果 room bounds 实际上是 tile 坐标，但 renderer 当成 pixel 坐标来画，位置就会错。

简单讲：

```text
RoomZones.js = 房间范围 debug，用来检查 room data 对不对
```

## DisplayOverlay.js

`DisplayOverlay.js` 负责画地图上方的 icon 和 label。

它主要处理：

```text
mapData.display.icons
mapData.display.labels
```

通常是先画 icon，再画 label。

`drawIcon()` 现在不是画真实图片 icon，而是画一个小圆点：

```text
黑色外圈
白色描边
中间白点
```

`drawLabel()` 会画文字，例如：

```text
A
B
Room 101
```

它会先画白色半透明背景，再画深色文字，让 label 在地图上更清楚。

关键函数是：

```js
displayToPixels(mapData, position)
```

它会判断 display 坐标是什么单位。

如果：

```js
mapData.display.coordinateSpace === "tile"
```

那它会乘上 `tileSize`：

```text
{ x: 1, y: 1 } → { x: 16px, y: 16px }
```

如果不是 tile，它就当成 pixel：

```text
{ x: 16, y: 16 } → { x: 16px, y: 16px }
```

简单讲：

```text
DisplayOverlay.js = 地图上方的标记、文字、目的地 icon
```

## 图层顺序

可以把这套 renderer 想成 Photoshop 图层：

```text
最底层：背景色
第二层：floor tile
第三层：room asset
第四层：wall / door / decoration
第五层：room zone debug
第六层：collision debug
最上层：icon / label
```

真实入口通常像这样：

```js
const grid = createTileGrid(mapData);
const composer = new LayerComposer(mapData, assetBundle, grid);

composer.render(ctx, {
  showRoomZones: false,
  showCollision: false,
  showDisplayOverlay: true
});
```

最后 Canvas 上就会出现完整地图。

## 和其他系统的边界

这个 renderer 只负责画。

它不负责：

```text
路线计算
路径搜索
sensor data 处理
PDR movement estimate
Particle Filter
真正的 collision blocking
actor movement update
```

这些应该放在对应的 routing、movement、sensor、estimate 或 collision logic 里面。

Renderer 可以显示它们的结果，但不应该拥有这些系统的核心逻辑。

## 要保证地图正确渲染，最重要的三件事

如果目标是根据 `map.json` 渲染出正确地图，最关键要保证：

```text
1. visualLayers 的 assetId 都能在 manifest / images 里面找到
2. placement.x / y 的单位稳定，通常是 tile 坐标
3. layer 分类顺序正确，例如 stairs typo 要修，否则绘制顺序可能错
```

只要这三件事稳定，renderer 就比较容易画出符合预期的地图。

## 总结

这几个文件组成了一个简单但清楚的 Canvas 地图渲染系统：

```text
TileGrid.js        = 管画布基础
TilesetRenderer.js = 管图片资产绘制
LayerComposer.js   = 管绘制顺序
CollisionLayer.js  = 管不可走区域 debug
RoomZones.js       = 管房间范围 debug
DisplayOverlay.js  = 管 label / icon
index.js           = 管统一导出
```

目前它已经可以根据 `mapData.visualLayers` 和 tileset asset 把地图画出来。

后续最应该注意的是坐标单位一致、assetId 对得上资源，以及 layer 分类规则保持正确。
