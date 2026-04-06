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
 * 节点数阈值：超过此值使用 WebGL，否则使用 Canvas
 * 可通过环境变量 VITE_WEBGL_NODE_THRESHOLD 配置，默认 500
 */
export const WEBGL_NODE_THRESHOLD = parseInt(
  import.meta.env.VITE_WEBGL_NODE_THRESHOLD || '500',
  10
)

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
 * 根据节点数量决定是否使用 WebGL
 */
export function shouldUseWebGL(nodeCount: number): boolean {
  // 节点数小于阈值时使用 Canvas
  if (nodeCount < WEBGL_NODE_THRESHOLD) {
    return false
  }
  // 节点数大于阈值时，检查 WebGL 支持
  return isWebGLSupported()
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
 * 注意：边的样式由 createGraphOption 中的 series.lineStyle 和 edgeSymbol 统一控制
 */
export function prepareEdgeData(
  edges: any[]
): EdgeRenderData[] {
  return edges.map((edge) => {
    const isInternal = edge.type === 'internal_cite'

    return {
      source: edge.source,
      target: edge.target,
      value: 1,
      lineStyle: {
        color: isInternal ? '#3b82f6' : '#9ca3af',
        width: isInternal ? 2 : 1,
        curveness: 0.3,
        type: isInternal ? 'solid' : 'dashed',
      },
      symbol: ['none', 'arrow'] as const,
      symbolSize: [0, isInternal ? 10 : 6],
    }
  })
}

/**
 * 创建 ECharts 图谱配置
 */
export function createGraphOption(
  nodes: NodeRenderData[],
  edges: EdgeRenderData[],
  config: RenderConfig = DEFAULT_RENDER_CONFIG,
  useWebGL: boolean = false
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
        // 性能优化配置（仅在大数据量时启用）
        progressive: useWebGL ? config.progressive : 0,
        progressiveThreshold: useWebGL ? config.progressiveThreshold : Infinity,
        // 力导向布局配置
        force: {
          repulsion: 350,
          edgeLength: [100, 250],
          gravity: 0.08,
          layoutAnimation: true,
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
        // 边箭头配置（统一在这里设置，不在 prepareEdgeData 中设置）
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 10],
      },
    ],
    // WebGL 渲染配置
    useWebGL,
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
