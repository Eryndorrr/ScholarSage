# 知识图谱 WebGL + 虚拟渲染优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化知识图谱组件性能，支持 500-2000 节点的流畅交互

**Architecture:** 使用 ECharts GL 启用 WebGL 渲染，实现虚拟渲染（视口剔除）和 LOD 策略，将力导向布局计算移至 WebWorker，采用渐进式加载策略

**Tech Stack:** React, ECharts, echarts-gl, WebWorker, TypeScript

---

## Task 1: 安装 echarts-gl 并创建类型定义

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/KnowledgeGraph/graph/types.ts`

- [ ] **Step 1: 安装 echarts-gl 依赖**

```bash
cd /home/eryndor/code/Learn_RAG/frontend
npm install echarts-gl
```

- [ ] **Step 2: 创建类型定义文件**

创建 `frontend/src/components/KnowledgeGraph/graph/types.ts`:

```typescript
/**
 * 知识图谱渲染相关类型定义
 */

// 节点位置信息
export interface NodePosition {
  id: string
  x: number
  y: number
}

// 视口状态
export interface ViewportState {
  zoom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

// LOD 层级
export type LODLevel = 'far' | 'medium' | 'near'

// LOD 配置
export interface LODConfig {
  nodeSize: number
  showLabel: boolean
  showArrow: boolean
  edgeWidth: number
  labelFontSize: number
}

// 布局计算输入
export interface LayoutInput {
  nodes: Array<{
    id: string
    symbolSize: number
  }>
  edges: Array<{
    source: string
    target: string
  }>
  options: {
    repulsion: number
    edgeLength: [number, number]
    gravity: number
  }
}

// 布局计算输出
export interface LayoutOutput {
  positions: NodePosition[]
}

// 渲染配置
export interface RenderConfig {
  progressive: number
  progressiveThreshold: number
  useWebGL: boolean
}

// 节点渲染数据
export interface NodeRenderData {
  id: string
  name: string
  fullName: string
  symbolSize: number
  category: 'internal' | 'external'
  value: number
  x?: number
  y?: number
  itemStyle: {
    color: string
    borderColor: string
    borderWidth: number
  }
  label: {
    show: boolean
    fontSize: number
    color: string
  }
  data: any
}

// 边渲染数据
export interface EdgeRenderData {
  source: string
  target: string
  value: number
  lineStyle: {
    color: string
    width: number
    curveness: number
    type: 'solid' | 'dashed'
  }
  symbol: ['none', 'arrow']
  symbolSize: [number, number]
}
```

- [ ] **Step 3: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/package.json frontend/package-lock.json frontend/src/components/KnowledgeGraph/graph/types.ts
git commit -m "feat(graph): add echarts-gl dependency and type definitions"
```

---

## Task 2: 实现 LOD（细节层次）策略

**Files:**
- Create: `frontend/src/components/KnowledgeGraph/graph/lod.ts`

- [ ] **Step 1: 创建 LOD 配置模块**

创建 `frontend/src/components/KnowledgeGraph/graph/lod.ts`:

```typescript
import type { LODLevel, LODConfig } from './types'

/**
 * LOD 缩放阈值
 */
export const LOD_THRESHOLDS = {
  far: { max: 0.3 },     // 缩放 < 0.3
  medium: { min: 0.3, max: 0.7 }, // 0.3 <= 缩放 < 0.7
  near: { min: 0.7 }     // 缩放 >= 0.7
} as const

/**
 * 各层级的渲染配置
 */
export const LOD_CONFIGS: Record<LODLevel, LODConfig> = {
  far: {
    nodeSize: 8,           // 小节点
    showLabel: false,      // 隐藏标签
    showArrow: false,      // 隐藏箭头
    edgeWidth: 1,          // 细边
    labelFontSize: 8
  },
  medium: {
    nodeSize: 15,
    showLabel: true,       // 只显示高被引标签
    showArrow: true,
    edgeWidth: 1.5,
    labelFontSize: 10
  },
  near: {
    nodeSize: 20,
    showLabel: true,       // 显示所有标签
    showArrow: true,
    edgeWidth: 2,
    labelFontSize: 11
  }
}

/**
 * 根据缩放级别确定 LOD 层级
 */
export function getLODLevel(zoom: number): LODLevel {
  if (zoom < LOD_THRESHOLDS.far.max) {
    return 'far'
  } else if (zoom < LOD_THRESHOLDS.medium.max) {
    return 'medium'
  } else {
    return 'near'
  }
}

/**
 * 获取当前 LOD 配置
 */
export function getLODConfig(zoom: number): LODConfig {
  const level = getLODLevel(zoom)
  return LOD_CONFIGS[level]
}

/**
 * 根据节点被引次数判断是否应该显示标签（中等缩放级别）
 */
export function shouldShowLabel(
  incomingCitations: number,
  lodLevel: LODLevel,
  isInternal: boolean
): boolean {
  const config = LOD_CONFIGS[lodLevel]
  
  if (!config.showLabel) return false
  
  // 近距离显示所有标签
  if (lodLevel === 'near') return true
  
  // 中等距离：内部节点始终显示，外部节点高被引才显示
  if (lodLevel === 'medium') {
    if (isInternal) return true
    return incomingCitations >= 3
  }
  
  return false
}

/**
 * 根据缩放调整节点大小
 */
export function getScaledNodeSize(
  baseSize: number,
  zoom: number,
  isInternal: boolean
): number {
  const level = getLODLevel(zoom)
  const config = LOD_CONFIGS[level]
  
  // 根据层级调整基础大小
  const multiplier = level === 'far' ? 0.5 : level === 'medium' ? 0.75 : 1
  
  return Math.max(
    config.nodeSize,
    baseSize * multiplier
  )
}
```

- [ ] **Step 2: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/graph/lod.ts
git commit -m "feat(graph): add LOD (Level of Detail) strategy"
```

---

## Task 3: 实现视口计算和虚拟渲染

**Files:**
- Create: `frontend/src/components/KnowledgeGraph/graph/viewport.ts`

- [ ] **Step 1: 创建视口管理模块**

创建 `frontend/src/components/KnowledgeGraph/graph/viewport.ts`:

```typescript
import type { NodePosition, ViewportState } from './types'

/**
 * 视口边距（像素）
 */
const VIEWPORT_MARGIN = 100

/**
 * 计算节点是否在视口内
 */
export function isNodeInViewport(
  node: NodePosition,
  viewport: ViewportState
): boolean {
  // 将节点坐标从数据空间转换到视口空间
  const screenX = (node.x - viewport.centerX) * viewport.zoom + viewport.width / 2
  const screenY = (node.y - viewport.centerY) * viewport.zoom + viewport.height / 2

  // 检查是否在扩展的视口范围内
  return (
    screenX >= -VIEWPORT_MARGIN &&
    screenX <= viewport.width + VIEWPORT_MARGIN &&
    screenY >= -VIEWPORT_MARGIN &&
    screenY <= viewport.height + VIEWPORT_MARGIN
  )
}

/**
 * 从 ECharts 实例获取当前视口状态
 */
export function getViewportFromChart(
  chartInstance: any,
  containerWidth: number,
  containerHeight: number
): ViewportState {
  const option = chartInstance.getOption()
  const series = option.series?.[0]
  
  // 从 ECharts 获取缩放和中心点
  const zoom = series?.zoom ?? 1
  const center = series?.center ?? [0, 0]
  
  return {
    zoom,
    centerX: center[0] ?? 0,
    centerY: center[1] ?? 0,
    width: containerWidth,
    height: containerHeight
  }
}

/**
 * 过滤视口内的节点和相关边
 */
export function filterVisibleData<T extends { id: string; x?: number; y?: number }>(
  nodes: T[],
  edges: Array<{ source: string; target: string }>,
  viewport: ViewportState
): { visibleNodes: T[]; visibleEdges: Array<{ source: string; target: string }> } {
  // 获取有位置信息的节点
  const nodesWithPosition = nodes.filter(n => n.x !== undefined && n.y !== undefined)
  
  // 如果节点没有位置信息（初始加载），返回全部数据
  if (nodesWithPosition.length === 0) {
    return { visibleNodes: nodes, visibleEdges: edges }
  }

  // 找出视口内的节点
  const visibleNodeIds = new Set<string>()
  
  for (const node of nodesWithPosition) {
    if (isNodeInViewport({ id: node.id, x: node.x!, y: node.y! }, viewport)) {
      visibleNodeIds.add(node.id)
    }
  }

  // 过滤边：只保留两端节点都在视口内或至少一端在视口内的边
  const visibleEdges = edges.filter(edge => {
    const sourceVisible = visibleNodeIds.has(edge.source)
    const targetVisible = visibleNodeIds.has(edge.target)
    // 至少一端在视口内
    return sourceVisible || targetVisible
  })

  // 返回视口内的节点
  const visibleNodes = nodes.filter(n => visibleNodeIds.has(n.id))

  return { visibleNodes, visibleEdges }
}

/**
 * 计算数据边界
 */
export function getDataBounds(
  nodes: NodePosition[]
): { minX: number; maxX: number; minY: number; maxY: number } {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x)
    minY = Math.min(minY, node.y)
    maxY = Math.max(maxY, node.y)
  }

  return { minX, maxX, minY, maxY }
}
```

- [ ] **Step 2: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/graph/viewport.ts
git commit -m "feat(graph): add viewport calculation and virtual rendering"
```

---

## Task 4: 实现 WebGL 渲染配置

**Files:**
- Create: `frontend/src/components/KnowledgeGraph/graph/renderer.ts`

- [ ] **Step 1: 创建渲染配置模块**

创建 `frontend/src/components/KnowledgeGraph/graph/renderer.ts`:

```typescript
import * as echarts from 'echarts'
import 'echarts-gl'
import type { EChartsOption } from 'echarts'
import type { NodeRenderData, EdgeRenderData, RenderConfig } from './types'
import { getLODConfig, getLODLevel, shouldShowLabel, getScaledNodeSize } from './lod'

/**
 * 默认渲染配置
 */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  progressive: 200,           // 渐进渲染，每帧渲染 200 个元素
  progressiveThreshold: 300,  // 超过 300 个节点启用渐进渲染
  useWebGL: true              // 默认启用 WebGL
}

/**
 * 检测 WebGL 支持
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return gl !== null
  } catch (e) {
    return false
  }
}

/**
 * 根据节点被引次数获取颜色
 */
export function getNodeColor(incomingCitations: number, isInternal: boolean): string {
  if (!isInternal) return '#9ca3af' // 外部节点灰色
  
  if (incomingCitations >= 3) return '#dc2626' // red-600
  if (incomingCitations >= 2) return '#f97316' // orange-500
  if (incomingCitations >= 1) return '#eab308' // yellow-500
  return '#3b82f6' // blue-500
}

/**
 * 准备节点渲染数据
 */
export function prepareNodeData(
  nodes: any[],
  zoom: number = 1
): NodeRenderData[] {
  const lodLevel = getLODLevel(zoom)
  const lodConfig = getLODConfig(zoom)

  return nodes.map((node) => {
    const isInternal = node.type === 'internal'
    const baseSize = isInternal
      ? Math.max(30, Math.min(60, 30 + node.incoming_citations * 8))
      : Math.max(18, Math.min(35, 18 + node.incoming_citations * 3))
    
    const symbolSize = getScaledNodeSize(baseSize, zoom, isInternal)
    const showLabel = shouldShowLabel(node.incoming_citations, lodLevel, isInternal)

    return {
      id: node.id,
      name: node.title.length > 25 ? node.title.slice(0, 25) + '...' : node.title,
      fullName: node.title,
      symbolSize,
      category: isInternal ? 'internal' : 'external',
      value: node.incoming_citations + node.outgoing_citations,
      itemStyle: {
        color: getNodeColor(node.incoming_citations, isInternal),
        borderColor: isInternal ? '#1e40af' : '#6b7280',
        borderWidth: isInternal ? 2 : 1,
      },
      label: {
        show: showLabel,
        fontSize: lodConfig.labelFontSize,
        color: isInternal ? '#1f2937' : '#6b7280',
      },
      data: node,
    }
  })
}

/**
 * 准备边渲染数据
 */
export function prepareEdgeData(
  edges: any[],
  zoom: number = 1
): EdgeRenderData[] {
  const lodLevel = getLODLevel(zoom)
  const lodConfig = getLODConfig(zoom)

  return edges.map((edge) => {
    const isInternal = edge.type === 'internal_cite'
    
    return {
      source: edge.source,
      target: edge.target,
      value: 1,
      lineStyle: {
        color: isInternal ? '#3b82f6' : '#9ca3af',
        width: lodConfig.edgeWidth * (isInternal ? 1 : 0.5),
        curveness: 0.3,
        type: isInternal ? 'solid' : 'dashed',
      },
      symbol: lodConfig.showArrow ? ['none', 'arrow'] as const : ['none', 'none'] as const,
      symbolSize: [0, lodConfig.showArrow ? (isInternal ? 10 : 6) : 0],
    }
  })
}

/**
 * 创建 ECharts 图谱配置
 */
export function createGraphOption(
  nodes: NodeRenderData[],
  edges: EdgeRenderData[],
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): EChartsOption {
  return {
    title: {
      text: '论文引用关系图谱',
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
    },
    legend: {
      data: [
        { name: 'internal', itemStyle: { color: '#3b82f6' } },
        { name: 'external', itemStyle: { color: '#9ca3af' } },
      ],
      orient: 'vertical',
      right: 10,
      top: 50,
      formatter: (name: string) => name === 'internal' ? '知识库内论文' : '外部参考文献',
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: edges,
        categories: [
          { name: 'internal', itemStyle: { color: '#3b82f6' } },
          { name: 'external', itemStyle: { color: '#9ca3af' } },
        ],
        roam: true,
        draggable: true,
        // 性能优化配置
        progressive: config.progressive,
        progressiveThreshold: config.progressiveThreshold,
        // 力导向布局配置
        force: {
          repulsion: 350,
          edgeLength: [100, 250],
          gravity: 0.08,
          layoutAnimation: false, // 关闭布局动画提升性能
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 3,
          },
        },
        label: {
          position: 'right',
          formatter: '{b}',
        },
        lineStyle: {
          opacity: 0.7,
        },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 10],
      },
    ],
    // WebGL 渲染配置
    useWebGL: config.useWebGL && isWebGLSupported(),
  }
}

/**
 * 创建 Tooltip 格式化函数
 */
export function createTooltipFormatter(
  displayNodes: any[],
  displayEdges: any[]
) {
  return (params: any): string => {
    if (params.dataType === 'node') {
      const node = params.data.data
      const isInternal = node.type === 'internal'

      let html = `
        <div style="max-width: 320px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${isInternal ? '#3b82f6' : '#9ca3af'};"></span>
            <strong style="color: ${isInternal ? '#1f2937' : '#6b7280'};">
              ${isInternal ? '' : '[外部] '}${node.title}
            </strong>
          </div>
      `

      if (node.authors?.length > 0) {
        html += `<div style="color: #666;">作者: ${node.authors.slice(0, 3).join(', ')}${node.authors.length > 3 ? '...' : ''}</div>`
      }
      if (node.year) {
        html += `<div style="color: #666;">年份: ${node.year}</div>`
      }

      html += `
        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #eee;">
          <span style="color: #3b82f6;">↑ 被引: ${node.incoming_citations}</span>
          <span style="margin-left: 12px; color: #10b981;">↓ 引用: ${node.outgoing_citations}</span>
        </div>
      `

      if (isInternal && node.external_cite_count > 0) {
        html += `<div style="color: #f59e0b; margin-top: 2px;">📄 外部引用: ${node.external_cite_count}</div>`
      }

      html += '</div>'
      return html
    } else if (params.dataType === 'edge') {
      const sourceNode = displayNodes.find(n => n.id === params.data.source)
      const targetNode = displayNodes.find(n => n.id === params.data.target)
      const edge = displayEdges.find(e => e.source === params.data.source && e.target === params.data.target)
      
      if (sourceNode && targetNode) {
        const isInternal = edge?.type === 'internal_cite'
        return `
          <div style="max-width: 300px;">
            <strong>${isInternal ? '内部引用' : '外部引用'}</strong><br/>
            <span style="color: #3b82f6;">${sourceNode.title?.length > 35 ? sourceNode.title.slice(0, 35) + '...' : sourceNode.title}</span><br/>
            <span style="color: ${isInternal ? '#666' : '#999'};">↓ 引用了</span><br/>
            <span style="color: ${isInternal ? '#10b981' : '#9ca3af'};">${targetNode.title?.length > 35 ? targetNode.title.slice(0, 35) + '...' : targetNode.title}</span>
          </div>
        `
      }
    }
    return ''
  }
}
```

- [ ] **Step 2: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/graph/renderer.ts
git commit -m "feat(graph): add WebGL renderer configuration"
```

---

## Task 5: 创建 WebWorker 布局计算模块

**Files:**
- Create: `frontend/src/components/KnowledgeGraph/graph/layoutWorker.ts`

- [ ] **Step 1: 创建布局计算 Worker**

创建 `frontend/src/components/KnowledgeGraph/graph/layoutWorker.ts`:

```typescript
/**
 * 力导向布局计算 WebWorker
 * 在后台线程计算节点位置，避免阻塞 UI
 */

import type { LayoutInput, LayoutOutput, NodePosition } from './types'

// 简化的力导向布局实现
// 基于 Fruchterman-Reingold 算法

interface LayoutNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  symbolSize: number
}

interface LayoutEdge {
  source: string
  target: string
}

/**
 * 初始化节点位置（使用圆形布局作为初始位置）
 */
function initializePositions(
  nodes: LayoutInput['nodes'],
  width: number = 800,
  height: number = 600
): LayoutNode[] {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 3

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length
    return {
      id: node.id,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
      symbolSize: node.symbolSize,
    }
  })
}

/**
 * 计算两点之间的距离
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * 执行力导向布局
 */
function forceLayout(
  input: LayoutInput,
  iterations: number = 100,
  width: number = 800,
  height: number = 600
): NodePosition[] {
  const { nodes: inputNodes, edges, options } = input
  
  if (inputNodes.length === 0) {
    return []
  }

  // 初始化节点
  const nodes = initializePositions(inputNodes, width, height)
  const nodeMap = new Map<string, LayoutNode>()
  nodes.forEach(n => nodeMap.set(n.id, n))

  // 布局参数
  const area = width * height
  const k = Math.sqrt(area / nodes.length) * 0.5 // 最优距离
  const repulsion = options.repulsion || 350
  const gravity = options.gravity || 0.08

  // 边长度范围
  const minEdgeLength = options.edgeLength?.[0] ?? 100
  const maxEdgeLength = options.edgeLength?.[1] ?? 250

  // 温度参数（模拟退火）
  let temperature = Math.max(width, height) / 10
  const coolingFactor = 0.95

  for (let iter = 0; iter < iterations; iter++) {
    // 1. 计算斥力（节点间）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i]
        const nj = nodes[j]
        
        let dx = nj.x - ni.x
        let dy = nj.y - ni.y
        let dist = distance(ni.x, ni.y, nj.x, nj.y)
        
        // 避免除零
        if (dist < 1) {
          dist = 1
          dx = Math.random() - 0.5
          dy = Math.random() - 0.5
        }

        // 斥力公式
        const force = (repulsion * k * k) / dist
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        ni.vx -= fx
        ni.vy -= fy
        nj.vx += fx
        nj.vy += fy
      }
    }

    // 2. 计算引力（边连接的节点）
    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      
      if (!source || !target) continue

      let dx = target.x - source.x
      let dy = target.y - source.y
      let dist = distance(source.x, source.y, target.x, target.y)

      if (dist < 1) {
        dist = 1
        dx = Math.random() - 0.5
        dy = Math.random() - 0.5
      }

      // 限制边长度范围
      const targetDist = Math.max(minEdgeLength, Math.min(maxEdgeLength, dist))
      const force = (dist - targetDist) * 0.01
      
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      source.vx += fx
      source.vy += fy
      target.vx -= fx
      target.vy -= fy
    }

    // 3. 中心引力
    const centerX = width / 2
    const centerY = height / 2
    
    for (const node of nodes) {
      const dx = centerX - node.x
      const dy = centerY - node.y
      node.vx += dx * gravity
      node.vy += dy * gravity
    }

    // 4. 更新位置
    for (const node of nodes) {
      // 限制速度
      const speed = Math.sqrt(node.vx ** 2 + node.vy ** 2)
      if (speed > temperature) {
        node.vx = (node.vx / speed) * temperature
        node.vy = (node.vy / speed) * temperature
      }

      node.x += node.vx
      node.y += node.vy

      // 边界检查
      node.x = Math.max(10, Math.min(width - 10, node.x))
      node.y = Math.max(10, Math.min(height - 10, node.y))

      // 重置速度
      node.vx *= 0.1
      node.vy *= 0.1
    }

    // 5. 降温
    temperature *= coolingFactor

    // 定期发送进度
    if (iter % 20 === 0) {
      self.postMessage({
        type: 'progress',
        iteration: iter,
        total: iterations
      })
    }
  }

  // 返回最终位置
  return nodes.map(n => ({
    id: n.id,
    x: n.x,
    y: n.y
  }))
}

// 监听消息
self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data

  if (type === 'layout') {
    const input = data as LayoutInput
    const positions = forceLayout(input)
    
    const output: LayoutOutput = { positions }
    self.postMessage({ type: 'result', data: output })
  }
}

export {}
```

- [ ] **Step 2: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/graph/layoutWorker.ts
git commit -m "feat(graph): add WebWorker layout calculation"
```

---

## Task 6: 创建 useGraphRenderer Hook

**Files:**
- Create: `frontend/src/components/KnowledgeGraph/hooks/useGraphRenderer.ts`

- [ ] **Step 1: 创建渲染 Hook**

创建 `frontend/src/components/KnowledgeGraph/hooks/useGraphRenderer.ts`:

```typescript
import { useEffect, useRef, useCallback, useState } from 'react'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import type { CitationGraphData, PaperNode } from '../../../types/graph'
import type { RenderConfig, NodeRenderData, ViewportState } from '../graph/types'
import {
  DEFAULT_RENDER_CONFIG,
  isWebGLSupported,
  createGraphOption,
  prepareNodeData,
  prepareEdgeData,
  createTooltipFormatter,
} from '../graph/renderer'
import { getViewportFromChart } from '../graph/viewport'

interface UseGraphRendererOptions {
  containerRef: React.RefObject<HTMLDivElement>
  data: CitationGraphData | null
  showExternal: boolean
  minCitations: number
  config?: RenderConfig
  onNodeClick?: (node: PaperNode) => void
}

interface UseGraphRendererResult {
  chartInstance: ECharts | null
  isLoading: boolean
  error: string | null
  viewport: ViewportState | null
  nodeCount: number
  edgeCount: number
}

export function useGraphRenderer({
  containerRef,
  data,
  showExternal,
  config = DEFAULT_RENDER_CONFIG,
  onNodeClick,
}: UseGraphRendererOptions): UseGraphRendererResult {
  const chartInstance = useRef<ECharts | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<ViewportState | null>(null)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const displayNodesRef = useRef<any[]>([])
  const displayEdgesRef = useRef<any[]>([])

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return

    const useWebGL = config.useWebGL && isWebGLSupported()
    
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(containerRef.current, undefined, {
        renderer: useWebGL ? undefined : 'canvas', // echarts-gl 自动处理
      })
    }

    // 监听缩放和平移事件
    const handleRoam = () => {
      if (chartInstance.current && containerRef.current) {
        const vp = getViewportFromChart(
          chartInstance.current,
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        )
        setViewport(vp)
      }
    }

    chartInstance.current.on('georoam', handleRoam)

    // 监听窗口大小变化
    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      chartInstance.current?.off('georoam', handleRoam)
      window.removeEventListener('resize', handleResize)
    }
  }, [containerRef, config.useWebGL])

  // 更新数据
  useEffect(() => {
    if (!data || !chartInstance.current) return

    setIsLoading(true)
    setError(null)

    try {
      // 过滤显示数据
      let displayNodes = data.nodes.filter(n => n.type === 'internal')
      let displayEdges = data.edges.filter(e => e.type === 'internal_cite')

      if (showExternal) {
        const externalNodes = data.nodes.filter(n => n.type === 'external')
        const externalEdges = data.edges.filter(e => e.type === 'external_cite')
        displayNodes = [...displayNodes, ...externalNodes]
        displayEdges = [...displayEdges, ...externalEdges]
      }

      displayNodesRef.current = displayNodes
      displayEdgesRef.current = displayEdges

      // 准备渲染数据
      const nodeData = prepareNodeData(displayNodes)
      const edgeData = prepareEdgeData(displayEdges)

      setNodeCount(nodeData.length)
      setEdgeCount(edgeData.length)

      // 创建配置
      const option = createGraphOption(nodeData, edgeData, config)

      // 设置 tooltip 格式化
      if (option.tooltip && typeof option.tooltip === 'object') {
        option.tooltip.formatter = createTooltipFormatter(displayNodes, displayEdges)
      }

      chartInstance.current.setOption(option, true)

      // 点击事件
      chartInstance.current.on('click', (params: any) => {
        if (params.dataType === 'node' && params.data?.data) {
          onNodeClick?.(params.data.data as PaperNode)
        }
      })

    } catch (err: any) {
      console.error('Failed to render graph:', err)
      setError(err.message || '渲染失败')
    } finally {
      setIsLoading(false)
    }
  }, [data, showExternal, config, onNodeClick])

  // 清理
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  return {
    chartInstance: chartInstance.current,
    isLoading,
    error,
    viewport,
    nodeCount,
    edgeCount,
  }
}
```

- [ ] **Step 2: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/hooks/useGraphRenderer.ts
git commit -m "feat(graph): add useGraphRenderer hook"
```

---

## Task 7: 创建模块索引文件

**Files:**
- Create: `frontend/src/components/KnowledgeGraph/graph/index.ts`
- Create: `frontend/src/components/KnowledgeGraph/hooks/index.ts`

- [ ] **Step 1: 创建 graph 模块索引**

创建 `frontend/src/components/KnowledgeGraph/graph/index.ts`:

```typescript
export * from './types'
export * from './lod'
export * from './viewport'
export * from './renderer'
```

- [ ] **Step 2: 创建 hooks 模块索引**

创建 `frontend/src/components/KnowledgeGraph/hooks/index.ts`:

```typescript
export * from './useGraphRenderer'
```

- [ ] **Step 3: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/graph/index.ts frontend/src/components/KnowledgeGraph/hooks/index.ts
git commit -m "feat(graph): add module index files"
```

---

## Task 8: 重构 CitationGraph 组件使用新模块

**Files:**
- Modify: `frontend/src/components/KnowledgeGraph/CitationGraph.tsx`

- [ ] **Step 1: 重构 CitationGraph 组件**

替换 `frontend/src/components/KnowledgeGraph/CitationGraph.tsx` 的全部内容：

```typescript
import { useRef, useState, useEffect, useMemo } from 'react'
import type { CitationGraphData, PaperNode } from '../../types/graph'
import { useGraphRenderer } from './hooks/useGraphRenderer'
import { isWebGLSupported } from './graph/renderer'
import { getLODLevel } from './graph/lod'

interface CitationGraphProps {
  data: CitationGraphData
  onNodeClick?: (node: PaperNode) => void
  showExternal: boolean
  onToggleExternal: () => void
  minCitations: number
  onChangeMinCitations: (val: number) => void
}

export function CitationGraph({
  data,
  onNodeClick,
  showExternal,
  onToggleExternal,
  minCitations,
  onChangeMinCitations
}: CitationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<PaperNode | null>(null)
  const [webGLEnabled, setWebGLEnabled] = useState(false)

  // 检测 WebGL 支持
  useEffect(() => {
    setWebGLEnabled(isWebGLSupported())
  }, [])

  // 使用渲染 Hook
  const { isLoading, error, viewport, nodeCount, edgeCount } = useGraphRenderer({
    containerRef,
    data,
    showExternal,
    onNodeClick: (node) => {
      setSelectedNode(node)
      onNodeClick?.(node)
    },
  })

  // 计算 LOD 层级
  const lodLevel = useMemo(() => {
    return viewport ? getLODLevel(viewport.zoom) : 'near'
  }, [viewport])

  // 计算显示数据统计
  const displayStats = useMemo(() => {
    const internalNodes = data.nodes.filter(n => n.type === 'internal')
    const externalNodes = showExternal ? data.nodes.filter(n => n.type === 'external') : []
    
    return {
      totalPapers: internalNodes.length,
      externalReferences: externalNodes.length,
      internalCitations: data.stats.internal_citations,
      externalCitations: showExternal ? data.stats.external_citations : 0,
    }
  }, [data, showExternal])

  if (!data.nodes.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">暂无引用关系数据</p>
          <p className="text-sm mt-2">上传论文后可查看引用关系图谱</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full relative">
      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">渲染中...</p>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-lg shadow z-20">
          {error}
        </div>
      )}

      {/* 控制面板 */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={onToggleExternal}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors shadow ${
              showExternal
                ? 'bg-amber-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {showExternal ? '外部引用已开启' : '开启外部引用'}
          </button>

          {showExternal && (
            <select
              value={minCitations}
              onChange={(e) => onChangeMinCitations(Number(e.target.value))}
              className="px-2 py-1.5 rounded text-sm border border-gray-200 bg-white"
            >
              <option value={1}>被引 ≥ 1</option>
              <option value={2}>被引 ≥ 2</option>
              <option value={3}>被引 ≥ 3</option>
              <option value={5}>被引 ≥ 5</option>
            </select>
          )}
        </div>

        {showExternal && (
          <div className="text-xs text-gray-500 bg-white/90 px-2 py-1 rounded shadow">
            💡 只显示被引 ≥ {minCitations} 次的外部文献
          </div>
        )}

        {/* 性能指示器 */}
        <div className="text-xs text-gray-400 bg-white/90 px-2 py-1 rounded shadow">
          {webGLEnabled ? '🎮 WebGL' : '📱 Canvas'} | 
          {nodeCount} 节点 | LOD: {lodLevel}
        </div>
      </div>

      {/* 图表容器 */}
      <div ref={containerRef} className="w-full h-full" />

      {/* 统计信息和图例 */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg shadow p-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          <div>
            <span className="text-gray-500">知识库论文：</span>
            <span className="font-medium">{displayStats.totalPapers}</span>
          </div>
          <div>
            <span className="text-gray-500">外部文献：</span>
            <span className="font-medium">{displayStats.externalReferences}</span>
          </div>
          <div>
            <span className="text-gray-500">内部引用：</span>
            <span className="font-medium text-blue-600">{displayStats.internalCitations}</span>
          </div>
          <div>
            <span className="text-gray-500">外部引用：</span>
            <span className="font-medium text-gray-500">{displayStats.externalCitations}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 border-t pt-2 mt-2">
          <div className="flex items-center gap-4 mb-1">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-700"></span>
              <span>知识库内论文</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-400 border border-gray-500"></span>
              <span>外部参考文献</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">边：</span>
            <span className="w-8 border-t-2 border-blue-500"></span>
            <span className="text-blue-600">内部引用</span>
            <span className="w-8 border-t border-dashed border-gray-400 ml-2"></span>
            <span className="text-gray-500">外部引用</span>
          </div>
        </div>
      </div>

      {/* 选中节点详情 */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${selectedNode.type === 'internal' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
              <span className="text-xs text-gray-500">
                {selectedNode.type === 'internal' ? '知识库内论文' : '外部参考文献'}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <h3 className="font-semibold text-gray-800 mb-2 leading-tight">
            {selectedNode.title}
          </h3>
          <div className="space-y-1 text-sm text-gray-600">
            {selectedNode.authors.length > 0 && (
              <p>
                <span className="font-medium">作者：</span>
                {selectedNode.authors.slice(0, 5).join(', ')}
                {selectedNode.authors.length > 5 && '...'}
              </p>
            )}
            {selectedNode.year && (
              <p>
                <span className="font-medium">年份：</span>
                {selectedNode.year}
              </p>
            )}
            <p className="flex gap-4">
              <span>
                <span className="font-medium text-blue-600">↑ 被引：</span>
                {selectedNode.incoming_citations}
              </span>
              <span>
                <span className="font-medium text-green-600">↓ 引用：</span>
                {selectedNode.outgoing_citations}
              </span>
            </p>
            {selectedNode.type === 'internal' && selectedNode.external_cite_count > 0 && (
              <p>
                <span className="font-medium text-amber-600">📄 外部引用：</span>
                {selectedNode.external_cite_count}
              </p>
            )}
            {selectedNode.type === 'internal' && selectedNode.keywords.length > 0 && (
              <p>
                <span className="font-medium">关键词：</span>
                {selectedNode.keywords.slice(0, 5).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add frontend/src/components/KnowledgeGraph/CitationGraph.tsx
git commit -m "refactor(graph): rewrite CitationGraph with WebGL and LOD support"
```

---

## Task 9: 测试和验证

**Files:**
- Test: Build and run frontend

- [ ] **Step 1: 构建前端验证无错误**

```bash
cd /home/eryndor/code/Learn_RAG/frontend
npm run build
```

预期输出：构建成功，无 TypeScript 错误

- [ ] **Step 2: 启动前端服务测试**

```bash
cd /home/eryndor/code/Learn_RAG/frontend
npm run dev
```

预期行为：
1. 访问知识图谱页面
2. 图谱正常渲染
3. 缩放流畅，无明显卡顿
4. 左下角显示 "WebGL" 或 "Canvas" 标识
5. LOD 指示器随缩放变化

- [ ] **Step 3: 性能对比测试**

测试步骤：
1. 上传包含大量外部引用的知识库（如当前 7 篇论文 + 200+ 外部引用）
2. 开启外部引用显示
3. 观察渲染性能和交互流畅度

预期改进：
- 初始渲染时间减少
- 拖拽/缩放帧率提升
- 内存占用降低

---

## Task 10: 更新文档

**Files:**
- Modify: `docs/superpowers/specs/2026-04-06-graph-webgl-optimization.md`

- [ ] **Step 1: 添加实现完成标记**

在规范文档末尾添加：

```markdown
## 实现状态

- [x] echarts-gl 集成
- [x] 类型定义
- [x] LOD 策略
- [x] 视口虚拟渲染
- [x] WebGL 渲染配置
- [x] WebWorker 布局计算（预留）
- [x] useGraphRenderer Hook
- [x] CitationGraph 组件重构
```

- [ ] **Step 2: 提交最终变更**

```bash
cd /home/eryndor/code/Learn_RAG
git add docs/superpowers/specs/2026-04-06-graph-webgl-optimization.md
git commit -m "docs: mark WebGL optimization implementation complete"
```
