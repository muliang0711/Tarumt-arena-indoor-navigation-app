# Edge 距离说明

## 1. Edge 用来连接两个节点

`map.json` 的 `movement.routeGraph.edges` 已经支持 Edge。每个 Edge 可以连接两个节点，并直接记录距离：

```json
{
  "edge_id": "node_1_to_node_2",
  "from_node": "node_1",
  "to_node": "node_2",
  "bidirectional": true,
  "distance_m": 1.2,
  "weight": 1.2,
  "enabled": true
}
```

- `edge_id`：Edge 的唯一 ID。
- `from_node`：起点节点 ID。
- `to_node`：终点节点 ID。
- `bidirectional`：设为 `true` 时允许双向通行。
- `distance_m`：真实物理距离，单位是米。
- `weight`：寻路成本，用于比较不同路线。
- `enabled`：设为 `false` 时，这条 Edge 不参与寻路。

## 2. `distance_m` 和 `weight` 的区别

建议让两个字段承担不同职责：

- `distance_m` 用于显示距离、计算行走进度和预计时间。
- `weight` 用于选择路线，可以加入拥挤、楼梯、危险区域等额外成本。

例如：

```json
{
  "distance_m": 1.2,
  "weight": 5
}
```

这表示实际距离仍然是 `1.2` 米，但寻路算法会把这条 Edge 当作成本为 `5` 的路线。

## 3. 当前寻路代码的距离选择顺序

`debugger/navigationDebugModel.ts` 中的 `edgeWeight()` 按以下顺序取得寻路成本：

1. 如果存在有效的 `weight`，使用 `weight`。
2. 否则，如果存在有效的 `distance_m`，使用 `distance_m`。
3. 如果两个字段都不存在，使用两个节点坐标计算直线距离。

坐标距离公式：

```text
distance = √((x₂ - x₁)² + (y₂ - y₁)²)
```

Node 1 和 Node 2 的例子：

```text
Node 1 = (4.8, 5.2)
Node 2 = (4.8, 4.0)

distance = √((4.8 - 4.8)² + (4.0 - 5.2)²)
         = 1.2 米
```

如果希望寻路成本直接等于实际距离，可以让 `weight` 和 `distance_m` 保持相同，或者省略 `weight`：

```json
{
  "edge_id": "node_1_to_node_2",
  "from_node": "node_1",
  "to_node": "node_2",
  "bidirectional": true,
  "distance_m": 1.2,
  "enabled": true
}
```

## 4. 不修改 `map.json` 的动态距离

如果距离只需要在程序运行期间改变，可以使用运行时覆盖表：

```ts
const distanceOverrides: Record<string, number> = {
  node_1_to_node_2: 2.5,
};

function getDynamicDistance(edge: RouteEdge): number | undefined {
  const edgeId = edge.edge_id ?? edge.id;

  if (edgeId && distanceOverrides[edgeId] !== undefined) {
    return distanceOverrides[edgeId];
  }

  return edge.distance_m;
}
```

这样：

- `map.json` 仍然保存原始距离 `1.2` 米。
- 运行时可以临时把距离调整为 `2.5` 米。
- 不需要重写地图文件。
- 应用重新启动后，如果没有持久化覆盖数据，就会恢复原始距离。

也可以为所有 Edge 使用统一倍率：

```ts
const distanceScale = 1.5;
const adjustedDistance = originalDistance * distanceScale;
```

例如：

```text
原始距离 = 1.2 米
动态倍率 = 1.5
调整后距离 = 1.8 米
```

## 5. 注意事项

当前寻路算法优先使用 `weight`。只动态修改 `distance_m`，但保留原来的 `weight`，可能不会改变路线选择。

如果动态距离也应该影响寻路，可以：

1. 同时动态调整 `weight`；或者
2. 修改 `edgeWeight()`，让它使用动态距离覆盖值。

建议保持概念清晰：

```text
distance_m = 真实距离
weight     = 寻路成本
```
