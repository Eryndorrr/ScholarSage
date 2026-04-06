# 知识图谱 WebGL + 虚拟渲染优化设计

## 目标

优化知识图谱组件性能，支持 500-2000 节点的流畅交互。

## 问题分析

当前使用 ECharts Canvas 渲染，存在以下问题：
- 大量节点时初始加载慢
- 拖拽/缩放时卡顿
- 力导向布局计算阻塞主线程
- 所有节点全部渲染，无视是否在视口内

## 解决方案

### 1. WebGL 渲染

启用 ECharts WebGL 模式，利用 GPU 加速绑制。

```typescript
// 安装 echarts-gl
npm install echarts-gl

// 配置
import 'echarts-gl'
series: [{
  type: 'graph',
  // 启用 WebGL
  progressive: 200,        // 渐进渲染阈值
  progressiveThreshold: 300, // 超过此数量启用渐进
}]
```

### 2. 虚拟渲染（视口剔除）

只渲染视口内的节点和边。

```typescript
interface ViewportState {
  zoom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

function isInViewport(node: NodePosition, viewport: ViewportState): boolean {
  // 计算节点是否在视口内（带边距）
}

function filterVisibleData(nodes: Node[], edges: Edge[], viewport: ViewportState) {
  // 返回视口内的节点和相关边
}
```

### 3. LOD（细节层次）

根据缩放级别调整显示细节。

| 缩放级别 | 节点显示 | 标签显示 | 边显示 |
|---------|---------|---------|--------|
| 远（< 0.3）| 简化点 | 隐藏 | 无箭头 |
| 中（0.3-0.7）| 圆形 | 高被引 | 简化 |
| 近（> 0.7）| 完整 | 全部 | 完整 |

### 4. WebWorker 布局计算

将力导向布局计算移到 WebWorker，避免阻塞 UI。

```typescript
// layoutWorker.ts
self.onmessage = (e) => {
  const { nodes, edges, options } = e.data
  const positions = forceLayout(nodes, edges, options)
  self.postMessage(positions)
}

// CitationGraph.tsx
const worker = new Worker(new URL('./layoutWorker.ts', import.meta.url))
worker.postMessage({ nodes, edges })
worker.onmessage = (e) => updatePositions(e.data)
```

### 5. 渐进式加载

```typescript
// 阶段1：先加载内部节点（核心）
// 阶段2：加载高被引外部节点
// 阶段3：加载其余外部节点

async function loadGraphData() {
  const coreData = await fetchCoreData()
  render(coreData)

  setTimeout(async () => {
    const externalData = await fetchExternalData()
    render({ ...coreData, ...externalData })
  }, 100)
}
```

## 文件结构

```
frontend/src/components/KnowledgeGraph/
├── CitationGraph.tsx       # 主组件（重构）
├── graph/
│   ├── renderer.ts         # WebGL 渲染配置
│   ├── viewport.ts         # 视口计算和虚拟渲染
│   ├── layoutWorker.ts     # 布局计算 Worker
│   ├── lod.ts              # LOD 策略
│   └── types.ts            # 类型定义
└── hooks/
    └── useGraphRenderer.ts # 渲染逻辑 Hook
```

## 性能指标

| 指标 | 优化前 | 优化后目标 |
|-----|-------|----------|
| 初始加载（1000节点） | 3-5s | < 1s |
| 拖拽帧率 | 10-20 FPS | 50+ FPS |
| 内存占用 | 高 | 降低 30% |

## 风险

1. **echarts-gl 兼容性**：需要测试浏览器支持
2. **WebWorker 复杂度**：需要正确处理 Worker 生命周期
3. **虚拟渲染精度**：边界情况需要测试

## 回退方案

如果 WebGL 有问题，保留 Canvas 模式作为降级选项。

## 实现状态

- [x] echarts-gl 集成
- [x] 类型定义
- [x] LOD 策略
- [x] 视口虚拟渲染
- [x] WebGL 渲染配置
- [x] WebWorker 布局计算（预留）
- [x] useGraphRenderer Hook
- [x] CitationGraph 组件重构
