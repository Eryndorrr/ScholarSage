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
