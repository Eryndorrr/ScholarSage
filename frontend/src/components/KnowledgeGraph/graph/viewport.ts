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
