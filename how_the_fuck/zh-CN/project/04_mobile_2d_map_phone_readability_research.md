# 手机端 2D 地图可读性研究

## 目的

这份文档回答一个很具体的问题：

为什么很多 2D 游戏或地图系统可以放进手机里，但用户仍然看得清、点得到、不会迷路？

结论先说：

**他们通常不是把“完整地图原样硬缩小到手机里”来解决问题。**

行业里更常见的做法是：

1. 先用一个稳定的基准分辨率控制世界显示。
2. 把“世界层”和“UI 层”分开缩放。
3. 给用户提供总览态、阅读态、细节态，而不是只有一种缩放。
4. 用语义化覆盖层、分区、minimap、聚焦导航来替代“全图同时看清”。

你的截图里之所以难读，不是因为地图做错了，而是因为它现在还停留在：

`整图缩放展示` 这个阶段。

这只能看布局，不能看细节。

---

## 研究方式

本次检索使用英文关键词，输出文档为中文。

示例英文检索方向：

- `2d game mobile readability reference resolution`
- `pixel perfect camera crop frame mobile`
- `mobile game UI scale readability official docs`
- `pinch zoom accessibility Android official`
- `multiple resolutions portrait smartphone 2d game official`

优先采用官方文档与平台文档，再基于这些资料做工程推断。

---

## 从官方资料里能稳定得出的结论

### 1. 世界内容不能直接等同于 UI 可读性

Unity 的 `Canvas Scaler` 明确把 UI 的缩放和屏幕尺寸适配拆开处理，支持：

- `Scale With Screen Size`
- `Constant Physical Size`
- `Match Width or Height`
- `Expand`
- `Shrink`

这说明一个行业共识：

**游戏世界怎么显示，和按钮、标签、文字怎么保持可读，是两套问题。**

如果把地图内容和 UI 一起缩小，通常会同时牺牲：

- 房间辨识度
- 图标可见性
- 触控命中率
- 标签阅读性

### 2. 2D 像素内容必须有“参考分辨率”或“基准视口”

Unity 的 Pixel Perfect Camera 和 Godot 的多分辨率文档都强调：

- 需要 `Reference Resolution`
- 需要定义不同宽高比如何处理
- 需要决定是 `Crop`、`Keep`、`Expand` 还是 `Stretch`

换句话说，成熟做法不是“任意屏幕直接塞满”，而是：

**先定义设计基线，再决定在不同手机上是显示更多、裁掉一部分，还是加黑边。**

### 3. 手机端通常依赖“可缩放内容”而不是单一静态倍率

Android 官方明确提供：

- `ScaleGestureDetector`
- `Drag and scale`
- `Support user-scalable content`

这表明在触屏平台上，**缩放和拖拽本身就是标准交互能力**，不是补丁。

对于地图、室内导航、战术平面图这类内容，单一缩放倍率往往不够。

### 4. 高瘦屏幕应该被当作优势，而不是麻烦

Godot 官方针对移动端明确建议：

- 竖屏可使用 `720x1280` 或 `1080x1920` 作为基准
- `canvas_items + expand`
- 更好利用 `18:9`、`19:9` 等 tall smartphone 屏幕

这意味着很多开发者不是试图让所有手机都看到“完全一样的画面”，而是：

**让高屏手机天然显示更多上下内容。**

### 5. 重要控件和信息不能指望用户“自己凑近看”

Apple HIG 和 Android Accessibility 都强调了可读性底线：

- Apple：iOS 默认文本尺寸 17pt，最小 11pt；游戏文本需要在实际平台测试可读性
- Android：文本建议满足对比度阈值，小文字至少 `4.5:1`
- Android：交互控件触控目标至少 `48dp x 48dp`

这意味着任何“地图标签、楼梯按钮、楼层切换、定位点、缩放按钮”都不能做成装饰品大小。

### 6. 异形屏、安全区、刘海、状态栏会破坏地图边缘可见性

Android 的 cutout 官方文档明确要求：

- 重要 UI 不要被 cutout 遮住
- 精细触控控件不要放在 cutout 区
- 要读取安全 inset，不要硬编码

所以手机地图系统如果把核心按钮贴在边缘，很容易在不同设备上出问题。

---

## 业界常见方案

下面这些方案不是互斥的。真正成熟的产品通常是组合使用。

## 方案 A：整图总览态

### 做法

把整个地图缩放到手机宽度内，一屏尽量看完。

### 优点

- 用户马上理解整体结构
- 很适合初次进入地图时建立方向感
- 很适合楼层总览、路径全貌、区域分布

### 缺点

- 房间细节看不清
- 小图标、小门口、小标识会糊成一团
- 不能承担“主阅读态”

### 适用定位

**只适合 overview，不适合 detail reading。**

你的当前手机截图，本质上就是这个模式。

---

## 方案 B：总览态 + 阅读态 + 细节态

### 做法

至少提供三档查看方式：

1. `Overview`
   地图按宽度适配，优先看整体结构。
2. `Readable`
   放大到房间、门、楼梯、厕所、走廊能正常辨认。
3. `Detail`
   进一步放大，用来检查非常小的家具、设备、图标或入口。

### 优点

- 兼顾整体结构和局部可读性
- 用户心智清晰
- 与手机交互天然匹配

### 缺点

- 放大后必须支持导航，否则用户会迷路

### 工程成本

中等。

### 结论

这是最适合你当前项目的第一优先方案。

---

## 方案 C：放大阅读 + minimap / 视口框

### 做法

当地图进入 `Readable` 或 `Detail` 后：

- 主视图显示放大后的局部
- 侧边或角落显示 minimap
- 用一个 viewport rectangle 表示当前看到的是全图的哪一块

### 优点

- 放大后仍然不容易失去方向
- 用户知道自己在楼层中的位置
- 很适合室内地图和地铁/商场/校园导览

### 缺点

- 多一个信息层，需要做视觉层级

### 结论

如果地图超过一屏且细节很多，**minimap 几乎是标配补丁**。

---

## 方案 D：世界层与 UI 层完全分离

### 做法

把内容拆成两类：

1. 世界层
   房间、地板、楼梯、家具、道路、障碍
2. UI/语义层
   房间名、楼层切换、缩放按钮、当前位置、目的地、路径提示、图例

### 优点

- 地图可以按世界逻辑缩放
- UI 仍然维持可读、可点击
- 无需为了看清一个标签把整个地图放大到很夸张

### 缺点

- 需要你维护额外的标注数据

### 结论

真正“手机上可用”的地图，几乎都在做这件事。

**不要把“房间说明文字”烘焙进底图 PNG。**

底图负责空间感，语义层负责理解。

---

## 方案 E：语义化简化层

### 做法

在手机端不要要求用户看懂所有像素细节，而是额外提供一层更抽象的信息：

- 楼梯
- 电梯
- 厕所
- 教室
- 会议室
- 出入口
- 当前定位
- 推荐路径

它们可以用图标、点位、色块、边框、标签卡片来表达。

### 优点

- 比直接阅读像素地图更快
- 对低视力用户更友好
- 对陌生楼层更好用

### 缺点

- 需要定义“什么信息最重要”

### 结论

如果你的目标是“导航可用”，不是“地图好看”，那这个方案非常关键。

---

## 方案 F：按区域/房间分块，而不是永远显示整层

### 做法

不要默认让用户面对一整层地图。

可以先选：

- 楼层
- 区域
- 走廊段
- 房间群

然后只展示当前相关区块。

### 优点

- 天然提高局部可读性
- 减少一次需要理解的信息量
- 更适合导航任务流

### 缺点

- 需要导航入口设计得清楚

### 结论

如果地图继续变复杂，分块一定会比“整图缩小”更稳定。

---

## 方案 G：固定基准 + 裁切/黑边/扩展，而不是任意拉伸

### 做法

通过参考分辨率控制手机显示：

- 有些设备显示更多上下内容
- 有些设备 letterbox
- 有些设备 crop 一部分

但不要让地图任意变形。

### 优点

- 视觉稳定
- 像素风不容易失真
- 方便美术和程序对齐

### 缺点

- 需要明确你更重视“完整结构”还是“局部清晰”

### 结论

对像素风 / tilemap 来说，这比“随屏幕自由压缩”更专业。

---

## 这些方案之间的本质差异

| 方案 | 核心目标 | 最大优点 | 最大缺点 | 适合阶段 |
| --- | --- | --- | --- | --- |
| 整图总览态 | 看整体结构 | 一眼看全图 | 细节极差 | 初看地图 |
| 阅读态/细节态 | 看清局部 | 可读性高 | 需要平移导航 | 日常查看 |
| minimap | 保持方向感 | 放大后不迷路 | 多一层 UI | 放大查看 |
| 世界/UI 分离 | 同时保清晰和可点 | 产品级方案 | 需要更多数据 | 中长期 |
| 语义层 | 快速理解功能点 | 导航效率高 | 设计成本更高 | 导航场景 |
| 分块浏览 | 降低信息密度 | 小屏更友好 | 入口流程更复杂 | 大地图 |
| 参考分辨率 + crop/expand | 保证显示稳定 | 专业、可控 | 需要先定标准 | 基础架构 |

---

## 针对你当前项目的建议

## 第一阶段：立即该做

1. 保留整图 `Overview`
2. 把 `Readable` 作为默认查看态
3. 保留 `Detail` 给精查
4. 给放大态配 `minimap`
5. 给手机端提供方向移动和点击 minimap 导航

这一步已经是最直接的收益。

## 第二阶段：很快就该做

1. 把底图和语义层拆开
2. 把这些点做成 overlay：
   - 楼梯
   - 电梯
   - 厕所
   - 房间名
   - 当前位置
   - 目的地
3. 给 overlay 做更大的命中区域

这一步能把“能看”提升成“能用”。

## 第三阶段：如果要做成真正导航产品

1. 分区域查看
2. 任务导向模式
   - 去厕所
   - 去电梯
   - 去某个房间
3. 聚焦路径
   - 非当前路径内容降噪
   - 当前路径高亮
4. 手机无障碍模式
   - 更大字
   - 更大按钮
   - 更高对比度
   - 更少装饰纹理

---

## 对你现在这张图的具体判断

你的这张图主要问题不是“地图画得丑”，而是：

1. 信息密度对手机来说过高
2. 当前显示倍率更适合看结构，不适合读细节
3. 楼梯、会议室、厕所这类功能点没有被单独强化
4. 用户必须依赖像素细节理解空间，而不是依赖语义提示理解空间

所以真正的方向不是：

`把整张图再压得更精致一点`

而是：

`把手机端地图做成多层阅读系统`

---

## 推荐决策

如果你只想选一个工程上最值的方向：

**选：`Overview + Readable + Detail + Minimap + 语义 Overlay`**

原因：

- 不需要推翻你现有底图工作流
- 可以逐步上线
- 先解决手机可读性
- 再解决导航可用性
- 和 Unity / Godot / Android / Apple 的官方设计方向是一致的

---

## 对当前仓库的落地建议

建议按下面顺序推进：

1. 手机 reviewer 保留三档视图
2. editor/export 流程输出 map snapshot
3. 在 reviewer 中加 overlay 开关
4. 优先做这些 overlay 类型：
   - stairs
   - elevator
   - toilet
   - room label
   - current position
5. 后续再做区域切换与路径高亮

---

## 参考资料

以下链接均为本次英文检索使用的主要官方资料：

- Apple Typography  
  https://developer.apple.com/design/human-interface-guidelines/typography
- Apple Accessibility  
  https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple Designing for Games  
  https://developer.apple.com/design/human-interface-guidelines/designing-for-games
- Apple UI Design Tips  
  https://developer.apple.com/design/tips/
- Android Make apps more accessible  
  https://developer.android.com/guide/topics/ui/accessibility/apps
- Android Support display cutouts  
  https://developer.android.com/develop/ui/views/layout/display-cutout
- Android Drag and scale  
  https://developer.android.com/training/gestures/scale
- Android Support user-scalable content  
  https://developer.android.com/develop/ui/compose/accessibility/scalable-content
- Unity Canvas Scaler  
  https://docs.unity3d.com/es/2021.1/Manual/script-CanvasScaler.html
- Unity 2D Pixel Perfect  
  https://docs.unity3d.com/es/2021.1/Manual/com.unity.2d.pixel-perfect.html
- Unity Pixel Perfect Camera reference  
  https://docs.unity3d.com/ja/6000.0/Manual/urp/2d-pixelperfect-ref.html
- Godot Multiple Resolutions  
  https://docs.godotengine.org/en/4.5/tutorials/rendering/multiple_resolutions.html

---

## 最后一句话

手机端 2D 地图的关键不是：

**“怎么把整张图完整塞进去。”**

而是：

**“怎么让用户在不同任务下，分别看懂整体、看清局部、并且快速找到重点。”**
