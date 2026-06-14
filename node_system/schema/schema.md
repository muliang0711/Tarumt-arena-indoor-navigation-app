# Navigation Graph Schema Design

> **Design Philosophy**: Topology + Semantics now, Physical precision later.

---

## Core Principle

```
凡是"拓扑 + 语义"相关的字段，必须现在填；
凡是"物理精度 / 优化指标"，可以以后补。
```

This schema is designed to build an MVP that **will not require refactoring** when features are added later.

---

## Node Schema

### 🔴 Required Fields (Cannot be null)

| Field | Type | Why Required |
|-------|------|--------------|
| `node_id` | string | **Topology anchor**. All edges and paths depend on this. No node_id = graph doesn't exist. |
| `floor_id` | number | **Cross-floor logic**. Even with one floor, fill this. Adding floors later won't require restructuring. |
| `x` | number | **Snap/nearest node**. Can be coarse (grid: 0,1,2,3) but must be consistent scale. |
| `y` | number | Same as x. Required for distance calculations. |
| `type` | NodeType | **Future expansion gateway**. All routing logic should use type, never hardcode node_id. |

### 🟢 Optional Fields (Can be null for MVP)

| Field | Type | Why Optional | When to Add |
|-------|------|--------------|-------------|
| `tags` | NodeTag[] | Advanced feature flags | When implementing accessibility, gendered facilities, emergency routes |
| `name` | string | UI display only | When you need human-readable labels |
| `enabled` | boolean | Defaults to true | When you need to temporarily disable nodes |
| `metadata` | object | Extensibility slot | When custom attributes are needed |

---

## Edge Schema

### 🔴 Required Fields (Cannot be null)

| Field | Type | Why Required |
|-------|------|--------------|
| `edge_id` | string | **Management/debugging**. Every edge needs an ID for updates and analysis. |
| `from_node` | string | **Graph skeleton**. Half of what makes a graph a graph. |
| `to_node` | string | **Graph skeleton**. The other half. |
| `bidirectional` | boolean | **Walk-ability**. Must be explicit: `true` = corridor, `false` = one-way door/escalator. |
| `weight` | number | **Pathfinding**. Even if you don't know real weight, use `weight = 1`. **Cannot be null!** |

### 🟢 Optional Fields (Can be null for MVP)

| Field | Type | Why Optional | When to Add |
|-------|------|--------------|-------------|
| `distance_m` | number | Wi-Fi error > measurement error | When you need accurate ETAs |
| `time_s` | number | Can derive from distance later | For special cases (elevator wait time) |
| `accessibility` | enum | MVP doesn't need wheelchair routing | When implementing accessible routes |
| `enabled` | boolean | Defaults to true | For temporary closures |
| `metadata` | object | Extensibility slot | For custom attributes |

---

## Why These Fields Can Be Null

### `tags` (Node)
```
现在不做无障碍路由
现在不区分男女厕所
现在不做紧急路线
→ 以后加 tag 不影响任何现有结构
```

### `name` (Node)
```
Demo 阶段不需要显示名称
UI 可以用 node_id 作为 fallback
→ 以后加 name 是纯增量操作
```

### `distance_m` (Edge)
```
Wi-Fi 定位误差 ≈ 3-5米
你的距离测量误差 ≈ 0.5米
→ 现在精确测量是浪费时间
→ weight = 1 足够 MVP
→ 以后可以批量补充
```

### `time_s` (Edge)
```
time = distance / speed
→ 可以从 distance_m 推导
→ 特殊情况（电梯等待）再单独设置
```

### `accessibility` (Edge)
```
MVP 不做轮椅路线
MVP 不做老人友好路线
→ 字段存在即可
→ 值可以为 null
```

---

## What NOT To Do

### ❌ Don't measure real distances now
```javascript
// Wi-Fi positioning error (3-5m) > your measurement precision
// Waste of time in MVP phase
```

### ❌ Don't add nodes in the middle of corridors
```javascript
// Only place nodes at "decision points"
// - Junctions
// - Room entrances  
// - Floor connections
```

### ❌ Don't put semantics in code
```javascript
// ❌ WRONG
if (node.node_id === "N_12") { }

// ✅ CORRECT  
if (node.type === "toilet") { }
```

---

## MVP Checklist

### Node (每个节点必须检查)
- [x] `node_id` - 填写 ✅
- [x] `floor_id` - 填写 ✅
- [x] `x`, `y` - 填写（可粗糙）✅
- [x] `type` - 填写 ✅
- [ ] `tags` - 可选 ⭕
- [ ] `name` - 可选 ⭕

### Edge (每条边必须检查)
- [x] `edge_id` - 填写 ✅
- [x] `from_node` - 填写 ✅
- [x] `to_node` - 填写 ✅
- [x] `bidirectional` - 填写 ✅
- [x] `weight = 1` - 填写 ✅
- [ ] `distance_m` - 可选 ⭕
- [ ] `time_s` - 可选 ⭕

---

## Schema Files

| File | Description |
|------|-------------|
| [node.ts](./node.ts) | Node interface, types, and validation |
| [edge.ts](./edge.ts) | Edge interface, types, and validation |
| [index.ts](./index.ts) | Re-exports all schema types |

---

## Future Expansion Path

```
MVP (now)
├── Required fields only
├── weight = 1 for all edges
└── No tags

Phase 2 (later)
├── Measure real distances
├── Calculate time_s
└── Add accessibility tags

Phase 3 (even later)
├── Dynamic weights (congestion)
├── Time-based restrictions
└── Custom metadata
```

This schema ensures you **never have to refactor** - only add data.
