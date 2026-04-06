import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { CitationGraphData, PaperNode } from '../../types/graph'

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
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [selectedNode, setSelectedNode] = useState<PaperNode | null>(null)

  useEffect(() => {
    if (!chartRef.current || !data.nodes.length) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    // 显示内部节点 + 根据开关决定是否显示外部节点
    let displayNodes = data.nodes.filter(n => n.type === 'internal')
    let displayEdges = data.edges.filter(e => e.type === 'internal_cite')

    if (showExternal) {
      const externalNodes = data.nodes.filter(n => n.type === 'external')
      const externalEdges = data.edges.filter(e => e.type === 'external_cite')
      displayNodes = [...displayNodes, ...externalNodes]
      displayEdges = [...displayEdges, ...externalEdges]
    }

    // 准备节点数据
    const nodes = displayNodes.map((node) => {
      const isInternal = node.type === 'internal'
      const totalCitations = node.incoming_citations + node.outgoing_citations

      return {
        id: node.id,
        name: node.title.length > 25 ? node.title.slice(0, 25) + '...' : node.title,
        fullName: node.title,
        symbolSize: isInternal
          ? Math.max(30, Math.min(60, 30 + node.incoming_citations * 8))
          : Math.max(18, Math.min(35, 18 + node.incoming_citations * 3)),
        category: isInternal ? 'internal' : 'external',
        value: totalCitations,
        itemStyle: {
          color: isInternal
            ? getInternalNodeColor(node.incoming_citations)
            : '#9ca3af',
          borderColor: isInternal ? '#1e40af' : '#6b7280',
          borderWidth: isInternal ? 2 : 1,
        },
        label: {
          show: isInternal,
          fontSize: isInternal ? 11 : 9,
          color: isInternal ? '#1f2937' : '#6b7280',
        },
        data: node,
      }
    })

    // 准备边数据
    const edges = displayEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: 1,
      lineStyle: {
        color: edge.type === 'internal_cite' ? '#3b82f6' : '#9ca3af',
        width: edge.type === 'internal_cite' ? 2 : 1,
        curveness: 0.3,
        type: edge.type === 'internal_cite' ? 'solid' as const : 'dashed' as const,
      },
      symbol: ['none', 'arrow'],
      symbolSize: [0, edge.type === 'internal_cite' ? 10 : 6],
    }))

    const option: EChartsOption = {
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
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const node = params.data.data as PaperNode
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

            if (node.authors.length > 0) {
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
            const edge = data.edges.find(e => e.source === params.data.source && e.target === params.data.target)
            const sourceNode = displayNodes.find(n => n.id === params.data.source)
            const targetNode = displayNodes.find(n => n.id === params.data.target)
            if (sourceNode && targetNode) {
              const isInternal = edge?.type === 'internal_cite'
              return `
                <div style="max-width: 300px;">
                  <strong>${isInternal ? '内部引用' : '外部引用'}</strong><br/>
                  <span style="color: #3b82f6;">${sourceNode.title.length > 35 ? sourceNode.title.slice(0, 35) + '...' : sourceNode.title}</span><br/>
                  <span style="color: ${isInternal ? '#666' : '#999'};">↓ 引用了</span><br/>
                  <span style="color: ${isInternal ? '#10b981' : '#9ca3af'};">${targetNode.title.length > 35 ? targetNode.title.slice(0, 35) + '...' : targetNode.title}</span>
                </div>
              `
            }
          }
          return ''
        },
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
          force: {
            repulsion: 350,
            edgeLength: [100, 250],
            gravity: 0.08,
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
    }

    chartInstance.current.setOption(option, true)

    // 点击事件
    chartInstance.current.on('click', (params: any) => {
      if (params.dataType === 'node') {
        const node = params.data.data as PaperNode
        setSelectedNode(node)
        onNodeClick?.(node)
      }
    })

    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [data, showExternal, onNodeClick])

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
      </div>

      <div ref={chartRef} className="w-full h-full" />

      {/* 统计信息和图例 */}
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg shadow p-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          <div>
            <span className="text-gray-500">知识库论文：</span>
            <span className="font-medium">{data.stats.total_papers}</span>
          </div>
          <div>
            <span className="text-gray-500">外部文献：</span>
            <span className="font-medium">{data.stats.external_references}</span>
          </div>
          <div>
            <span className="text-gray-500">内部引用：</span>
            <span className="font-medium text-blue-600">{data.stats.internal_citations}</span>
          </div>
          <div>
            <span className="text-gray-500">外部引用：</span>
            <span className="font-medium text-gray-500">{data.stats.external_citations}</span>
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
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
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

// 根据被引次数获取内部节点颜色
function getInternalNodeColor(incomingCitations: number): string {
  if (incomingCitations >= 3) return '#dc2626' // red-600
  if (incomingCitations >= 2) return '#f97316' // orange-500
  if (incomingCitations >= 1) return '#eab308' // yellow-500
  return '#3b82f6' // blue-500
}
