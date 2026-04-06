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
