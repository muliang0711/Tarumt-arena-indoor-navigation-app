# Camera、Viewport、Movement 与 Render System

## 目标

这份文档接在 `07_tilemap_runtime_dataflow.md` 后面，专门回答下面这些问题：

1. 地图大小和手机看到的范围有什么区别
2. `camera` / `viewport` / `zoom` 分别是什么
3. 为什么手机上不会一次看到整张地图
4. `Movement System` 到底是什么
5. `Render System` 到底是什么

---

## 一句话先讲完

对手机 2D RPG 来说，真正关键的不是“把整张地图塞进屏幕”，而是：

**用 `camera` 决定用户当前看到地图的哪一块，用 `zoom` 决定这块地图看得多近。**

---

## 1. 地图大小 和 视角大小 是两回事

### 地图大小

这是世界本身的大小。

例如：

```text
地图 = 100 x 100 tiles
每格 = 32 x 32 px
```

那么整张地图的世界尺寸就是：

```text
3200 x 3200 px
```

这是“世界到底有多大”。

### 视角大小

这是屏幕一次能看到多少地图。

例如手机一次只能看到：

```text
10 x 6 tiles
```

这代表玩家虽然在玩一张 `100 x 100` 的地图，但他实际上只看到了其中一个小窗口。

这个窗口通常就叫：

- `camera`
- `viewport`
- `visible area`

---

## 2. Camera 是什么

最简单的理解方式：

**地图是一张很大的纸。**

**手机屏幕是这张纸上的一个小窗。**

你移动的不是地图本身，而是这个“小窗”在大地图上的位置。

例如：

```text
地图 = 100 x 100
屏幕一次看到 = 10 x 6
玩家当前在 = (50, 30)
```

那当前 camera 可能覆盖的是：

```text
x: 45 ~ 54
y: 27 ~ 32
```

也就是说：

- 整张地图没有变
- 只是当前只显示其中一小块

---

## 3. Viewport 是什么

`Viewport` 可以理解成“屏幕上的观察框”。

从工程上说：

- `camera` 更偏“观察世界的逻辑”
- `viewport` 更偏“最终画到屏幕上的那个区域”

在很多项目里，这两个概念会一起讨论，因为它们总是配合工作。

你可以先用这个简化理解：

```text
Camera = 看哪里
Viewport = 显示出来的窗口
```

---

## 4. Zoom 是什么

`Zoom` 决定你看得多近。

### Zoom in

放大后：

- 每个 tile 看起来更大
- 一次能看到的地图更少
- 阅读性更好

### Zoom out

缩小后：

- 每个 tile 看起来更小
- 一次能看到的地图更多
- 全局感更强

例如手机屏幕宽度固定：

```text
放大时：一次看到 8 x 5 tiles
缩小时：一次看到 16 x 10 tiles
```

所以不是地图变大变小，而是 camera 的缩放比例改变了。

---

## 5. 手机上为什么通常不显示整张地图

因为如果把整张地图硬缩到手机里，结果通常会是：

- 看得到整体
- 但看不清细节
- 操作不舒服
- 路线、物件、门、楼梯都太小

所以常见做法是：

1. 保持一个适合阅读的默认缩放
2. `camera` 跟着角色移动
3. 只显示角色附近的一块区域
4. 用 `minimap` 帮用户理解全局

这也是大多数 2D RPG、室内导航图、楼层引导图在手机上的共通做法。

---

## 6. Camera Dataflow

```md
# Camera Dataflow

1. 地图很大
   - 例如 100 x 100 tiles

2. 屏幕很小
   - 例如一次只能显示 10 x 6 tiles

3. 玩家位置变化
   - player.x
   - player.y

4. camera 根据玩家位置更新
   - camera.x 跟随 player.x
   - camera.y 跟随 player.y

5. renderer 不把整张地图都画进屏幕
   - 只画 camera 当前覆盖的那一块

6. 如果 zoom 改变
   - camera 一次显示的 tile 数量也会改变
```

---

## 7. Movement System 是什么

严格说，哪怕它现在只有几十行逻辑，也完全可以叫 `Movement System`。

它的责任通常就是：

1. 接收输入
2. 算出角色下一步想去哪里
3. 查询碰撞
4. 如果能走，就更新角色位置

最小伪代码：

```js
function updateMovement(input, player, map) {
  let nextX = player.x;
  let nextY = player.y;

  if (input.left) nextX -= 1;
  if (input.right) nextX += 1;
  if (input.up) nextY -= 1;
  if (input.down) nextY += 1;

  if (!isBlocked(nextX, nextY, map.collisionLayer)) {
    player.x = nextX;
    player.y = nextY;
  }
}
```

所以你之前说的：

> 我有地图，我有角色，我直接去问地图下一步能不能走

这就是最小版 `Movement System`。

---

## 8. Render System 是什么

`Render System` 的核心职责是：

**把当前世界状态画出来。**

它通常要读取：

- `Tilemap`
- `Entities`
- `Camera`
- `UI State`

然后按顺序画。

最小伪代码：

```js
function renderFrame() {
  clearScreen();

  drawVisibleGround(camera, map);
  drawVisibleObjects(camera, map);
  drawEntities(camera, entities);
  drawVisibleForeground(camera, map);
  drawUI();
}
```

注意：

- `Render System` 不一定负责改逻辑
- 它主要负责“把当前状态转换成画面”

---

## 9. 为什么这些东西可以叫 System

在游戏里，`system` 不一定表示很大很复杂。

它更像是：

**一块职责明确的逻辑模块**

所以：

- `Map System`
  - 管地图数据
- `Entity System`
  - 管玩家、NPC、物件
- `Movement System`
  - 管移动和碰撞
- `Camera System`
  - 管视角和缩放
- `Render System`
  - 管绘制

哪怕现在只是几十行逻辑，只要职责清楚，就完全可以这样命名。

---

## 10. 一帧游戏的完整 Dataflow

```md
# 一帧游戏画面的 Dataflow

1. Input System
   - 玩家按方向键 / 摇杆

2. Movement System
   - 计算角色想去哪里
   - 查 collision
   - 更新 player state

3. Entity System
   - 维护 player / npc / monster / interactive object 当前状态

4. Camera System
   - 根据 player 位置更新 camera
   - 决定当前屏幕看到哪一块地图
   - 决定 zoom 比例

5. Render System
   - 读取 map
   - 读取 entities
   - 读取 camera
   - 只渲染当前可见区域
   - 再画 UI
```

---

## 11. 你现在最该记住的模型

```text
Map System
- 世界长什么样
- 哪些地方能走

Entity System
- 世界里有哪些角色和对象

Movement System
- 实体要往哪里走
- 能不能走
- 更新位置

Camera System
- 屏幕现在看地图的哪一块
- 跟不跟随玩家
- zoom 多大

Render System
- 把地图、实体、前景、UI 画出来
```

如果只记一句：

**地图决定世界长什么样，camera 决定你现在看世界的哪一块。**

