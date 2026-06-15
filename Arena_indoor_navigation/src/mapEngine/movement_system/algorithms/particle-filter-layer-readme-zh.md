# Particle Filter Layer

这份 README 说明 Particle Filter layer 的作用。

这一层接收前面 `estimate/` 产生的 `MotionEstimate`，然后用一组 particles 来估计更稳定的位置。

它目前的 scope 是：

```text
PDR + Particle Filter only
No map constraints
```

也就是说，它会根据移动估计来更新位置，但目前不会判断穿墙、路线是否合法，或是否离开 corridor。

## 这一层负责什么

Estimate / PDR layer 会告诉系统：

```text
这次大概移动了多少？
往哪个方向？
可信度多少？
```

Particle Filter layer 会用这些信息去更新一群可能位置。

整体流程是：

```text
MotionEstimate
    ↓
predictParticles()
    ↓
scoreParticles()
    ↓
resampleParticles()
    ↓
weighted average position
    ↓
final position estimate
```

简单讲：

```text
Particle Filter layer = 用很多个可能位置，慢慢逼近更稳定的当前位置
```

## 为什么需要 Particle Filter

Indoor positioning 的 sensor data 通常不会完全准确。

PDR 可能会告诉我们：

```text
用户往 90° 方向移动了 1.4m
```

但真实情况可能有误差：

```text
方向可能偏一点
步长可能不准
起点可能有偏差
sensor 可能有 noise
```

所以系统不应该只维护一个位置点。

Particle Filter 会维护很多个可能位置，也就是 particles。

每个 particle 代表一种可能：

```text
也许用户在这里
也许用户稍微偏左
也许用户稍微偏右
也许用户多走了一点
也许用户少走了一点
```

经过预测、评分和重采样之后，比较可信的位置会留下来，不可信的位置会慢慢被淘汰。

## particleTypes.ts

`particleTypes.ts` 负责定义 Particle Filter 的资料结构。

最重要的类型是：

```ts
Particle
```

一个 particle 代表一个可能的位置。

它主要包含：

```text
position        = 当前可能位置
headingRadians  = 当前方向
weight          = 这个 particle 的权重
confidence      = 可信度
age             = 存活了几轮
motion          = 上一次预测移动记录
```

另一个重要类型是：

```ts
ParticleFilterSnapshot
```

它代表整个 filter 当前的状态。

里面通常包含：

```text
particles
generation
position
headingRadians
confidence
bestParticle
totalWeight
lastMotion
```

简单讲：

```text
particleTypes.ts = Particle Filter 的数据 contract
```

## createParticles.ts

`createParticles.ts` 负责初始化 particles。

假设起点是：

```ts
{ x: 10, y: 20 }
```

它不会只创建一个点，而是在起点附近创建很多个 particles：

```text
particle-0: (10.1, 20.0)
particle-1: (9.9, 20.2)
particle-2: (10.3, 19.8)
...
```

这样做的原因是：室内定位一开始就可能有误差。

如果系统一开始只相信一个点，后面只要这个点错了，整个估计就会偏掉。

所以 Particle Filter 会从一开始就保留多个可能位置。

这个文件里使用 `goldenAngle`，主要是为了让 particles 分布得比较平均，不会全部挤在同一个方向。

## predictParticles.ts

`predictParticles.ts` 负责根据 `MotionEstimate` 移动每个 particle。

如果 `MotionEstimate` 说：

```text
往 90° 方向走了 1.4m
```

那每个 particle 都会大概往 90° 移动 1.4m。

不过它不会让所有 particles 移动到完全一样的位置。

它会加入一些 noise：

```text
headingJitter       = 方向小误差
distanceJitter      = 距离小误差
positionOffsetX/Y   = 位置小误差
```

原因是手机 sensor 不可能完全准确。

加入 noise 后，particles 会形成一个可能范围，而不是全部重叠在同一个点上。

## scoreParticles.ts

`scoreParticles.ts` 负责给每个 particle 打分。

目前评分主要看：

```text
1. particle 移动距离是否接近 motion estimate
2. particle 方向是否接近 motion estimate
3. motion 本身 confidence 高不高
4. particle 自己 confidence 高不高
```

分数越高，代表这个 particle 越可信。

这里有一个重要边界：

```text
目前 scoreParticles 没有 map constraints
```

所以它不会判断：

```text
有没有穿墙
有没有走进错误 corridor
有没有离开 route graph
```

这些判断之后可以放到 constraints layer，或者作为 Particle Filter 的额外 scoring rule。

## customScore

`scoreParticles.ts` 里面的 `customScore` 可以保留。

它现在更像是未来扩展 hook。

如果目前没有传入 constraints，它默认就是：

```text
customScore = 1
```

也就是说，它不会影响当前 scoring 逻辑。

文档上要写清楚：

```text
customScore 存在，不代表现在已经实现 map constraints。
它只是为之后加入 constraints scoring 预留入口。
```

## resampleParticles.ts

`resampleParticles.ts` 负责淘汰低权重 particles，并复制高权重 particles。

简单讲：

```text
高 weight particle → 更可能被复制
低 weight particle → 更可能消失
```

这样经过多轮更新后，particles 会慢慢集中在比较可能的位置附近。

这个过程叫 resampling。

目前使用的是 systematic resampling，这是一种常见的 Particle Filter 重采样方法。

## particleFilter.ts

`particleFilter.ts` 是 Particle Filter layer 的总控文件。

初始化时使用：

```ts
createParticleFilterState()
```

更新一轮时使用：

```ts
updateParticleFilterState()
```

它内部的主要流程是：

```text
predictParticles
    ↓
scoreParticles
    ↓
resampleParticles
    ↓
normalizeParticleWeights
    ↓
weightedAveragePosition
    ↓
weightedAverageHeading
```

最后输出当前估计结果：

```text
position
headingRadians
confidence
bestParticle
particles
```

## Weighted Average Position

Particle Filter 最后不会随便选一个 particle 当最终位置。

它会根据 particles 的 weight 计算加权平均位置。

直觉上可以理解成：

```text
越可信的 particle，对最终位置影响越大
越不可信的 particle，对最终位置影响越小
```

所以 final position estimate 通常会比单纯 PDR 的结果更稳定。

## 完整 Data Flow

```text
MotionEstimate
    ↓
predictParticles()
    ↓
predicted particles
    ↓
scoreParticles()
    ↓
weighted particles
    ↓
resampleParticles()
    ↓
resampled particles
    ↓
normalize weights
    ↓
weighted average position / heading
    ↓
ParticleFilterSnapshot
```

## 和前后 Layer 的关系

前一层是 Estimate / PDR layer。

它负责产生：

```text
stepDelta
heading
distanceMeters
confidence
```

Particle Filter layer 使用这些数据来更新 particles。

后一层可以是 map constraints 或 route constraints。

它们之后可以负责判断：

```text
particle 是否穿墙
particle 是否在可走区域
particle 是否偏离 route graph
particle 是否符合 building map
```

目前这套实现还没有把这些 constraints 放进 scoring。

所以当前可以描述为：

```text
PDR motion estimate + Particle Filter smoothing
```

## 总结

这 6 个文件组成 Particle Filter layer：

```text
particleTypes.ts       = 定义数据结构
createParticles.ts     = 初始化 particles
predictParticles.ts    = 根据 MotionEstimate 预测 particles 新位置
scoreParticles.ts      = 根据 motion 和 confidence 给 particles 打分
resampleParticles.ts   = 淘汰弱 particles，复制强 particles
particleFilter.ts      = 串起完整 Particle Filter 更新流程
```

这一层的核心价值是：

```text
不要只相信一个位置点。
用多个可能位置来吸收 sensor noise，然后输出更稳定的位置估计。
```

但要注意：

```text
目前没有 map constraints。
customScore 是未来扩展入口，不代表现在已经有地图约束。
```
