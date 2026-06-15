# Estimate / PDR Layer

这份 README 说明 estimate layer，也就是 PDR layer 的作用。

这一层负责把已经清理过的 sensor data，转换成一次可用的移动估计。

它不是 Particle Filter，也不是 map constraint layer。

它的主要责任是：

```text
clean sensor data
    ↓
stepEstimate：估计这次新增几步
    ↓
headingEstimate：估计当前方向
    ↓
displacementEstimate：估计移动距离
    ↓
motionEstimate：组合成一次完整移动估计
```

简单讲：

```text
Estimate / PDR layer = 先算出用户这次大概往哪个方向走了多远
```

## 这一层在系统里的位置

Preprocessing layer 负责清理 sensor data。

Estimate / PDR layer 负责把这些干净的数据变成移动估计。

Particle Filter 之后可以直接使用这个移动估计，而不需要自己理解 raw sensor data。

整体关系是：

```text
sensor / preprocessing data
    ↓
PDR motion estimate
    ↓
particle filter
    ↓
map constraints / position correction
```

所以这一层可以理解成一个中间翻译层。

它把 sensor 世界里的数据，翻译成定位算法更容易使用的格式：

```text
这次大概移动了多少？
往哪个方向？
可信度多少？
```

## stepEstimate.ts

`stepEstimate.ts` 负责估计步数变化。

它的核心输出是：

```ts
StepEstimate
```

里面主要包含：

```text
steps       = 当前总步数
stepDelta   = 这次新增几步
cadence     = 步频，可选
confidence  = 可信度，范围 0 - 1
source      = 数据来源，例如 pedometer
```

这里最重要的是 `stepDelta`。

它代表这一次更新中，用户新走了几步：

```text
stepDelta = current steps - previousSteps
```

例如：

```text
previousSteps = 100
current steps = 103
stepDelta = 3
```

意思是：这次系统估计用户新增走了 3 步。

如果输入数据出现 `NaN`、负数或其他不安全数值，这个模块会把它整理成安全数字，避免后续计算被污染。

## headingEstimate.ts

`headingEstimate.ts` 负责估计方向。

它的核心输出是：

```ts
HeadingEstimate
```

里面主要包含：

```text
radians     = 弧度方向
degrees     = 角度方向
unitVector  = 方向向量
confidence  = 可信度
source      = 来源，例如 deviceMotion / magnetometer / manual / unknown
```

例如 heading 是 90 度：

```text
degrees = 90
radians = 1.57
unitVector = { x: 0, y: 1 }
```

`unitVector` 很重要。

因为后面的 Particle Filter 或位置更新逻辑可以直接用它来移动：

```text
x += distance * unitVector.x
y += distance * unitVector.y
```

这个模块也会把方向限制在正常范围内：

```text
degrees: 0 - 360
radians: 0 - 2π
```

例如：

```text
370°  → 10°
-30°  → 330°
```

这样可以避免方向数值越来越乱。

## displacementEstimate.ts

`displacementEstimate.ts` 负责把步数和步长转换成移动距离。

它的核心输出是：

```ts
DisplacementEstimate
```

里面主要包含：

```text
distanceMeters     = 移动距离
heading            = 移动方向
stepLengthMeters   = 每一步的估计长度
confidence         = 可信度
```

核心计算很直接：

```text
distanceMeters = stepDelta * stepLengthMeters
```

例如：

```text
stepDelta = 3
stepLengthMeters = 0.7
distance = 2.1 meters
```

意思是：如果用户走了 3 步，每步大概 0.7m，那这次移动距离大约是 2.1m。

这个结果还不是最终位置。

它只是告诉后面的定位系统：

```text
用户这次大概移动了多少米，以及往哪个方向移动。
```

## motionEstimate.ts

`motionEstimate.ts` 负责把一次 PDR 估计组合起来。

它会把这些结果合成：

```text
StepEstimate
HeadingEstimate
DisplacementEstimate
```

最后输出：

```ts
MotionEstimate
```

里面主要包含：

```text
step
heading
displacement
confidence
timestamp
```

也就是说，`MotionEstimate` 表达的是一次完整移动估计：

```text
用户在这个时间点
往这个方向
走了几步
移动了多少米
这个估计有多可信
```

例如：

```text
stepDelta = 2
stepLength = 0.7m
heading = 90°
distance = 1.4m
```

这次 `MotionEstimate` 就可以理解成：

```text
用户往 90° 方向移动了大约 1.4m
```

## 完整 Data Flow

```text
PedometerStepSample
    ↓
createStepEstimate()
    ↓
StepEstimate

Heading input
    ↓
createHeadingEstimateFromDegrees()
    ↓
HeadingEstimate

StepEstimate + HeadingEstimate
    ↓
createDisplacementEstimateFromStepEstimate()
    ↓
DisplacementEstimate

Step + Heading + Displacement
    ↓
createMotionEstimate()
    ↓
MotionEstimate
```

## 为什么需要这一层

Particle Filter 不应该直接处理 raw sensor data。

如果 Particle Filter 直接理解 accelerometer、gyroscope、pedometer、device motion，它的责任会变得太复杂。

所以 estimate layer 先把 sensor data 整理成更高层的移动信息：

```text
stepDelta
heading
distanceMeters
confidence
```

Particle Filter 只需要关心这些结果，然后再结合地图、墙壁、路线和约束去修正位置。

## 和 Particle Filter 的边界

Estimate / PDR layer 负责：

```text
估计这次移动了多少
估计移动方向
估计可信度
```

Particle Filter 负责：

```text
根据移动估计更新粒子
结合地图约束过滤不合理位置
根据观测和权重修正最终位置
```

所以这一层不会判断用户有没有穿墙，也不会处理路线是否合法。

那些属于后面的 constraints 或 particle filter 逻辑。

## 小提醒

`motionEstimate.ts` 里面如果有类似这样的默认 confidence 组合：

```ts
confidence = combineConfidence(step.confidence, heading.confidence, step.confidence)
```

第三个值使用的是 `step.confidence`，不是 displacement confidence。

这个设计在逻辑上可以接受，因为 displacement 可能还没有创建。

不过为了让语义更清楚，之后可以考虑：

```text
1. 把这个 confidence 命名成 initial confidence
2. 或者等 displacement 创建后，再统一计算最终 confidence
```

整体来说，这一层的方向是正确的。

它就是 PDR 的核心估计层，负责把干净 sensor data 转换成后续定位算法可以使用的 motion estimate。
