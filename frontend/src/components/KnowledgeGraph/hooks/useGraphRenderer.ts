import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import type { CitationGraphData, PaperNode } from '../../../types/graph'
import type { RenderConfig, ViewportState } from '../graph/types'
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
