import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { TopicClusterData, TopicCluster } from '../../types/graph'

interface TopicClusterViewProps {
  data: TopicClusterData
  onClusterClick?: (cluster: TopicCluster) => void
}

export function TopicClusterView({ data, onClusterClick }: TopicClusterViewProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<TopicCluster | null>(null)
  const [viewMode, setViewMode] = useState<'bubble' | 'tree'>('bubble')

  useEffect(() => {
    if (!chartRef.current || !data.clusters.length) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    let option: EChartsOption

    if (viewMode === 'bubble') {
      option = getBubbleChartOption(data)
    } else {
      option = getTreeChartOption(data)
    }

    chartInstance.current.setOption(option, true)

    // 点击事件
    chartInstance.current.on('click', (params: any) => {
      const clusterId = params.data?.id
      if (clusterId) {
        const cluster = data.clusters.find((c) => c.id === clusterId)
        if (cluster) {
          setSelectedCluster(cluster)
          onClusterClick?.(cluster)
        }
      }
    })

    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [data, viewMode, onClusterClick])

  if (!data.clusters.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">暂无主题聚类数据</p>
          <p className="text-sm mt-2">上传包含关键词的论文后可查看主题聚类</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full relative">
      {/* 视图切换 */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => setViewMode('bubble')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'bubble'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          气泡图
        </button>
        <button
          onClick={() => setViewMode('tree')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'tree'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          树状图
        </button>
      </div>

      <div ref={chartRef} className="w-full h-full" />

      {/* 热门关键词 */}
      {data.top_keywords.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg shadow p-3 max-w-xs">
          <h4 className="text-sm font-medium text-gray-700 mb-2">热门关键词</h4>
          <div className="flex flex-wrap gap-1.5">
            {data.top_keywords.slice(0, 10).map((kw) => (
              <span
                key={kw.keyword}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {kw.keyword} ({kw.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 选中聚类详情 */}
      {selectedCluster && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm max-h-[80%] overflow-y-auto">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-gray-800">{selectedCluster.name}</h3>
            <button
              onClick={() => setSelectedCluster(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500">论文数量：</span>
              <span className="font-medium ml-1">{selectedCluster.paper_count}</span>
            </div>

            {selectedCluster.keywords.length > 0 && (
              <div>
                <span className="text-sm text-gray-500">关键词：</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedCluster.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCluster.paper_details.length > 0 && (
              <div>
                <span className="text-sm text-gray-500">相关论文：</span>
                <ul className="mt-1 space-y-1">
                  {selectedCluster.paper_details.slice(0, 5).map((paper, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      • {paper.title}
                      {paper.year && <span className="text-gray-400 ml-1">({paper.year})</span>}
                    </li>
                  ))}
                  {selectedCluster.paper_details.length > 5 && (
                    <li className="text-sm text-gray-400">
                      ...还有 {selectedCluster.paper_details.length - 5} 篇
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 气泡图配置
function getBubbleChartOption(data: TopicClusterData): EChartsOption {
  return {
    title: {
      text: '论文主题聚类',
      left: 'center',
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const cluster = data.clusters.find((c) => c.id === params.data.id)
        if (cluster) {
          return `
            <div>
              <strong>${cluster.name}</strong><br/>
              论文数: ${cluster.paper_count}<br/>
              关键词: ${cluster.keywords.slice(0, 3).join(', ')}
            </div>
          `
        }
        return ''
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        animation: true,
        animationDuration: 1000,
        data: data.clusters.map((cluster, index) => ({
          id: cluster.id,
          name: cluster.name,
          symbolSize: Math.sqrt(cluster.paper_count) * 15 + 20,
          category: index % 5,
          value: cluster.paper_count,
          label: {
            show: true,
            formatter: cluster.name,
            fontSize: 11,
          },
          itemStyle: {
            color: getClusterColor(index),
          },
        })),
        links: [],
        categories: Array.from({ length: 5 }, (_, i) => ({
          name: `类别 ${i + 1}`,
        })),
        roam: true,
        draggable: true,
        force: {
          repulsion: 300,
          gravity: 0.1,
        },
        emphasis: {
          focus: 'self',
          itemStyle: {
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
      },
    ],
  }
}

// 树状图配置
function getTreeChartOption(data: TopicClusterData): EChartsOption {
  const treeData = {
    name: '所有主题',
    children: data.clusters.map((cluster) => ({
      id: cluster.id,
      name: `${cluster.name} (${cluster.paper_count})`,
      value: cluster.paper_count,
      children: cluster.paper_details.slice(0, 3).map((paper) => ({
        name: paper.title.length > 30 ? paper.title.slice(0, 30) + '...' : paper.title,
        value: 1,
      })),
    })),
  }

  return {
    title: {
      text: '主题层级结构',
      left: 'center',
      top: 10,
    },
    tooltip: {
      trigger: 'item',
    },
    series: [
      {
        type: 'tree',
        data: [treeData],
        left: '10%',
        right: '20%',
        top: '15%',
        bottom: '10%',
        symbol: 'rect',
        symbolSize: [80, 24],
        orient: 'LR',
        label: {
          position: 'right',
          verticalAlign: 'middle',
          align: 'left',
          fontSize: 11,
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
          },
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
      },
    ],
  }
}

// 获取聚类颜色
function getClusterColor(index: number): string {
  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ]
  return colors[index % colors.length]
}
