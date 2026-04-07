# 当前 Demo 说明

## `demo` 应用已经具备的能力

你现在的流程已经很有用了：

- `src/parsing/graphParser.ts` 负责读取 JSON 节点和边
- `src/transform/sceneBuilder.ts` 负责把图结构投影到 tile 网格
- `src/render/pixelRenderer.ts` 负责绘制走廊、标记、标签和高亮
- `src/render/mapTheme.ts` 负责当前视觉配色
- `src/components/GraphCanvas.tsx` 负责平移、缩放、悬停和选择

## 这意味着什么

你并不是从代码零基础开始。

你已经有：

- 图数据加载
- 楼层过滤
- 场景生成
- canvas 渲染
- 交互

## 为什么它还不像精致像素地图

当前渲染器更偏重可读性，不偏重美术质量：

- 很多形状还是纯矩形
- 还没有 tile atlas
- 还没有装饰层
- 还没有手工摆放的 tile
- 视觉变化还比较少

这对原型阶段很正常。基础是好的，缺的是完整的美术工作流。
