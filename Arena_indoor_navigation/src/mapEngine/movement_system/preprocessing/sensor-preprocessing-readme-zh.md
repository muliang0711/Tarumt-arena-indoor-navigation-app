# Sensor Preprocessing Layer

这份 README 说明 sensor preprocessing layer 的作用，以及 `normalizeSensorSample.ts` 和 `sensorSampleWindow.ts` 如何一起工作。

## 这个 Layer 负责什么

Preprocessing layer 的目标不是计算位置，也不是做 PDR、Particle Filter 或路径推算。

它只负责一件事：

```text
把手机传来的 raw sensor data，整理成后面算法可以稳定使用的输入。
```

整体流程可以理解成：

```text
Raw phone sensor data
    ↓
normalizeSensorSample()
    ↓
clean sensor sample
    ↓
pushSensorSample()
    ↓
recent sensor window
    ↓
estimate layer
    ↓
step / heading / displacement
```

简单讲：

```text
normalizeSensorSample.ts = 清理每一笔 sensor 数据
sensorSampleWindow.ts = 保存最近一段 sensor 数据
```

## normalizeSensorSample.ts

`normalizeSensorSample.ts` 负责清理单笔 raw sensor data。

手机 sensor 有时可能传来不安全的数值，例如：

```ts
NaN
Infinity
undefined
null
```

这些值如果直接传给后面的 step detection、heading estimate 或 displacement estimate，可能会让计算结果变成错误值，甚至导致整个 movement estimate 不稳定。

所以这个文件会把坏数值转换成安全 fallback，通常是 `0`。

例如：

```ts
{
  kind: "accelerometer",
  timestamp: NaN,
  acceleration: {
    x: NaN,
    y: 9.8,
    z: Infinity
  }
}
```

经过 normalize 后会变成：

```ts
{
  kind: "accelerometer",
  timestamp: 0,
  acceleration: {
    x: 0,
    y: 9.8,
    z: 0
  }
}
```

它的重点不是删除数据，而是把数据变成安全格式。

## 它如何判断不同 Sensor

`normalizeSensorSample(sample)` 是主要入口。

它会根据 `sample.kind` 判断 sensor 类型，然后交给对应的 normalize function 处理：

```text
accelerometer → normalizeAccelerometerSample
gyroscope     → normalizeGyroscopeSample
magnetometer  → normalizeMagnetometerSample
pedometer     → normalizePedometerStepSample
deviceMotion  → normalizeDeviceMotionSample
```

这样后面的 preprocessing pipeline 不需要自己判断 sensor 类型，只要统一调用：

```ts
normalizeSensorSample(rawSample)
```

## 各 Sensor 会清理什么

Accelerometer sample 主要清理：

```text
timestamp
acceleration
gravity
intervalMs
```

这些数据之后通常会给 step detection 使用。

Gyroscope sample 主要清理：

```text
timestamp
rotationRate
intervalMs
```

这些数据之后可以辅助 heading 或 rotation estimate。

Magnetometer sample 主要清理：

```text
timestamp
magneticField
accuracy
intervalMs
```

这些数据之后可以辅助方向判断。

Pedometer sample 主要清理：

```text
timestamp
steps
cadence
```

其中 `steps` 会被整理成非负整数。

例如：

```text
3.8  → 3
-2   → 0
NaN  → 0
```

Device motion sample 主要清理综合 motion data：

```text
acceleration
accelerationIncludingGravity
rotationRate
attitude
intervalMs
```

如果某些 optional field 本来就是 `null` 或 `undefined`，它不会强行制造不存在的数据，而是尽量保留原本的 optional 状态。

## sensorSampleWindow.ts

`sensorSampleWindow.ts` 负责保存最近一段 sensor samples。

你可以把它想成一个固定大小的 queue。

例如 capacity 是 `3`：

```text
[ sample1 ]
[ sample1, sample2 ]
[ sample1, sample2, sample3 ]
[ sample2, sample3, sample4 ]
```

当新的 sample 加进来，并且数量超过 capacity 时，最旧的 sample 会被移除。

## 为什么需要 Window

PDR 和 step detection 通常不能只看一个 sensor 点。

走路时，加速度变化是一段连续波形，例如：

```text
低 → 高峰 → 低 → 高峰
```

如果只看单一 sample，很难判断这是不是一步。

所以系统需要一个 window 来保存最近一段 sensor data，让后面的 estimate layer 可以观察短时间内的变化趋势。

## Window 主要提供什么能力

`createSensorSampleWindow` 用来创建 window。

它会处理三件事：

```text
1. 确保 capacity 至少是 1
2. 根据 timestamp 排序 samples
3. 如果 samples 太多，只保留最新的几笔
```

`pushSensorSample` 用来加入新的 sample。

它会把新 sample 放进 window，然后自动保留最新的一段数据。

`getLatestSensorSample` 用来取得最新的一笔 sample。

`getOldestSensorSample` 用来取得最旧的一笔 sample。

`getSensorSampleWindowDurationMs` 用来计算这个 window 覆盖了多久时间。

例如：

```text
oldest timestamp = 1000
latest timestamp = 1600
duration = 600ms
```

这个 duration 之后可以用来判断：

```text
这段 sensor data 是否足够长
是否可以开始检测一步
当前 movement estimate 是否稳定
```

`isSensorSampleWindowFull` 用来判断 window 是否已经达到 capacity。

## 总结

这两个文件都属于 preprocessing layer。

`normalizeSensorSample.ts` 负责把每一笔 sensor data 清理成安全格式。

`sensorSampleWindow.ts` 负责保存最近一段 sensor data，让后面的算法可以基于一段时间内的变化来做判断。

它们本身不负责计算步数、方向、位移或最终位置。

它们的价值是帮后面的 estimate layer 准备干净、稳定、可用的输入。
