# 基于 Edge 真实距离的 Actor 移动设计

## 1. 目标

每条 Edge 可以拥有不同的真实距离，距离由 `map.json` 中的 `distance_m` 定义。

用户真实行走时：

- 使用传感器计算用户已经行走的米数。
- 使用当前 Edge 的 `distance_m` 计算完成进度。
- 根据进度，在 Edge 的起点和终点之间插值 Actor 的地图位置。
- Actor 允许停留在两个格子之间，因此位置可以是小数。

本设计将以下两个概念分开：

```text
真实距离：用户在现实世界行走了多少米
地图位置：Actor 在视觉地图上的显示位置
```

## 2. Edge 数据来源

每条 Edge 在 `map.json` 中定义自己的真实距离：

```json
{
  "edge_id": "node_1_to_node_2",
  "from_node": "node_1",
  "to_node": "node_2",
  "bidirectional": true,
  "distance_m": 20,
  "weight": 20,
  "enabled": true
}
```

这里表示：

- Node 1 到 Node 2 的真实距离是 `20` 米。
- 两个节点在视觉地图上可以只相隔 `3` 个格子。
- 真实米数不需要等于地图坐标之间的距离。

不同 Edge 可以定义不同距离：

```text
Node 1 → Node 2 = 20 米
Node 2 → Node 3 = 12 米
Node 3 → Node 4 = 30 米
```

每进入一条新 Edge，都必须使用该 Edge 自己的 `distance_m`。

## 3. 核心计算

### 3.1 Edge 进度

```text
progress = walkedMetersOnEdge / edge.distance_m
```

进度必须限制在 `0` 到 `1` 之间：

```ts
const progress = Math.min(
  1,
  Math.max(0, walkedMetersOnEdge / edge.distance_m),
);
```

含义：

```text
progress = 0    Actor 在起点
progress = 0.5  Actor 在起点和终点中间
progress = 1    Actor 到达终点
```

### 3.2 Actor 地图位置

使用线性插值计算 Actor 在地图上的位置：

```ts
const position = {
  x: from.position.x + (to.position.x - from.position.x) * progress,
  y: from.position.y + (to.position.y - from.position.y) * progress,
};
```

通用公式：

```text
position = start + (end - start) × progress
```

这里的 `(x, y)` 是连续坐标，不应该取整。

## 4. 示例：20 米对应地图上的 3 个格子

假设：

```text
Node 1 tile position = (12, 13)
Node 2 tile position = (12, 10)
真实 Edge 距离     = 20 米
用户已经行走       = 1 米
```

首先计算进度：

```text
progress = 1 / 20
         = 0.05
         = 5%
```

地图上的总视觉距离是 `3` 个格子，因此：

```text
地图移动距离 = 3 × 0.05
             = 0.15 个格子
```

Actor 的新位置：

```text
x = 12 + (12 - 12) × 0.05
  = 12

y = 13 + (10 - 13) × 0.05
  = 12.85
```

结果：

```text
Actor tile position = (12, 12.85)
```

Actor 会显示在格子之间，这是正确行为。

在当前地图坐标系统中，Node 1 和 Node 2 的逻辑位置是：

```text
Node 1 = (4.8, 5.2)
Node 2 = (4.8, 4.0)
```

同样使用 `5%` 进度：

```text
x = 4.8 + (4.8 - 4.8) × 0.05
  = 4.8

y = 5.2 + (4.0 - 5.2) × 0.05
  = 5.14
```

渲染时再把连续地图坐标转换为像素。不要在转换前对位置取整。

## 5. 建议的运行时状态

移动系统需要知道 Actor 当前位于哪一条 Edge，以及已经走了多少真实距离：

```ts
type EdgeTraversalState = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  walkedMetersOnEdge: number;
  edgeDistanceMeters: number;
  progress: number;
};
```

字段含义：

- `edgeId`：当前 Edge。
- `fromNodeId`：这次移动的起点。
- `toNodeId`：这次移动的终点。
- `walkedMetersOnEdge`：进入当前 Edge 后累计的真实行走距离。
- `edgeDistanceMeters`：当前 Edge 的 `distance_m`。
- `progress`：当前 Edge 的完成比例。

`walkedMetersOnEdge` 不应该与整条路线的累计距离混在一起。

## 6. 每次收到行走距离时的数据流

```text
传感器产生新的行走距离
        ↓
累加 walkedMetersOnEdge
        ↓
读取当前 Edge.distance_m
        ↓
计算 progress
        ↓
插值计算 Actor.position
        ↓
连续坐标转换为像素
        ↓
在两个节点之间显示 Actor
```

概念伪代码：

```ts
function updateActorOnEdge(
  actor: Actor,
  edge: RouteEdge,
  fromNode: RouteNode,
  toNode: RouteNode,
  walkedMetersOnEdge: number,
): Actor {
  const edgeDistanceMeters = edge.distance_m;

  if (edgeDistanceMeters === undefined || edgeDistanceMeters <= 0) {
    return actor;
  }

  const progress = Math.min(
    1,
    Math.max(0, walkedMetersOnEdge / edgeDistanceMeters),
  );

  return {
    ...actor,
    position: {
      x:
        fromNode.position.x +
        (toNode.position.x - fromNode.position.x) * progress,
      y:
        fromNode.position.y +
        (toNode.position.y - fromNode.position.y) * progress,
    },
  };
}
```

这段代码只是设计示例，不是当前实现。

## 7. 到达节点和进入下一条 Edge

当 `progress` 达到 `1`：

1. Actor 精确对齐当前 Edge 的终点节点。
2. 当前节点更新为 `toNodeId`。
3. 路线选择下一条 Edge。
4. `walkedMetersOnEdge` 重置为 `0`。
5. 下一次移动使用新 Edge 的 `distance_m`。

如果一次传感器更新的距离超过当前 Edge 剩余距离，不能丢弃多余距离。

例如：

```text
当前 Edge 剩余距离 = 0.4 米
本次检测移动距离   = 1.0 米
```

处理方式：

```text
0.4 米用于完成当前 Edge
剩余 0.6 米继续用于下一条 Edge
```

因此，正式实现时应使用循环消费本次移动距离，直到：

- 距离已经全部消费；或者
- 路线已经结束；或者
- 下一条 Edge 无效。

## 8. 双向 Edge

当 `bidirectional` 是 `true` 时，Actor 可以反方向移动。

例如从 Node 2 返回 Node 1：

```text
fromNode = Node 2
toNode   = Node 1
```

插值公式保持不变，只需要交换起点和终点。

`distance_m` 在两个方向上默认相同。如果未来两个方向的真实距离或成本不同，应定义两条单向 Edge。

## 9. `distance_m` 和 `weight`

本设计中：

```text
distance_m = Actor 完成这条 Edge 需要行走的真实米数
weight     = 寻路算法比较路线时使用的成本
```

Actor 移动进度必须使用 `distance_m`，不能使用 `weight`。

`weight` 可以因为拥挤、楼梯或危险区域而大于 `distance_m`，但不应该因此改变 Actor 的实际移动进度。

## 10. 异常数据处理

正式实现时建议使用以下规则：

- `distance_m` 不存在：拒绝开始该 Edge，或明确使用坐标距离作为回退值。
- `distance_m <= 0`：视为无效 Edge，避免除以零。
- 起点或终点不存在：停止 Edge 移动并报告错误。
- Edge 被禁用：不能开始或继续使用该 Edge。
- 行走距离为负数或非有限数：忽略该输入。
- `progress > 1`：完成当前 Edge，并把剩余距离传递到下一条 Edge。

建议不要静默混用 `weight` 作为移动距离，因为这会让寻路成本和真实距离重新耦合。

## 11. 与当前系统的兼容性

当前系统已经具备支持这种设计的基础：

- Actor 的逻辑位置支持小数。
- 米到像素的转换支持小数。
- Actor 渲染保留小数像素移动。
- 传感器移动估计已经使用 `distanceMeters`。

需要新增的主要能力是：

- 跟踪当前 Edge。
- 跟踪当前 Edge 已行走的真实米数。
- 将真实米数转换为 `progress`。
- 使用 `progress` 插值 Actor 的地图位置。
- 到达节点后切换到路线中的下一条 Edge。
- 正确处理一次移动跨越多条 Edge 的情况。

## 12. 设计结论

采用“每条 Edge 独立距离 + 进度插值”的方式：

```text
每条 Edge 的真实距离来自 map.json 的 distance_m
用户行走米数只用于计算当前 Edge 的 progress
Actor 地图位置由起点、终点和 progress 计算
Actor 坐标保留小数，可以显示在任意两个格子之间
```

这个设计允许视觉地图保持紧凑，同时让每条路线拥有独立、可配置的真实距离。

本文档只记录设计，不包含实现修改。
