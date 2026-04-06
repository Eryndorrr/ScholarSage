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
  symbol: ['none', 'arrow' | 'none']
  symbolSize: [number, number]
}
