import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CitationGraph } from './CitationGraph'
import { TopicClusterView } from './TopicClusterView'
import { graphService } from '../../services/graphService'
import { collectionService } from '../../services/collectionService'
import type { CitationGraphData, TopicClusterData, GraphStats } from '../../types/graph'
import type { Collection } from '../../types/collection'

type ViewType = 'citation' | 'topic'

interface KnowledgeGraphPageProps {
  onBack?: () => void
}

export function KnowledgeGraphPage({ onBack }: KnowledgeGraphPageProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>('citation')
  const [citationData, setCitationData] = useState<CitationGraphData | null>(null)
  const [topicData, setTopicData] = useState<TopicClusterData | null>(null)
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExternal, setShowExternal] = useState(false)
  const [minCitations, setMinCitations] = useState(2)

  // 加载集合列表
  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      const response = await collectionService.list()
      setCollections(response)
      if (response.length > 0) {
        setSelectedCollectionId(response[0].id)
      }
    } catch (err) {
      console.error('Failed to load collections:', err)
    }
  }

  // 加载图谱数据
  useEffect(() => {
    if (!selectedCollectionId) return
    loadGraphData()
  }, [selectedCollectionId])

  // 切换外部引用或过滤条件时重新加载
  useEffect(() => {
    if (selectedCollectionId && viewType === 'citation') {
      loadGraphData()
    }
  }, [showExternal, minCitations])

  const loadGraphData = async () => {
    if (!selectedCollectionId) return

    setLoading(true)
    setError(null)

    try {
      // 加载统计
      const statsResponse = await graphService.getGraphStats(selectedCollectionId)
      setStats(statsResponse)

      if (viewType === 'citation') {
        const citationResponse = await graphService.getCitationGraphData(
          selectedCollectionId,
          showExternal,
          minCitations
        )
        setCitationData(citationResponse)
      } else {
        const topicResponse = await graphService.getTopicClustersData(selectedCollectionId)
        setTopicData(topicResponse)
      }
    } catch (err: any) {
      console.error('Failed to load graph data:', err)
      setError(err.response?.data?.detail || '加载图谱数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 切换视图类型时重新加载
  useEffect(() => {
    if (selectedCollectionId) {
      loadGraphData()
    }
  }, [viewType])

  const handleToggleExternal = () => {
    setShowExternal(!showExternal)
  }

  const handleChangeMinCitations = (val: number) => {
    setMinCitations(val)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">返回</span>
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-800">知识图谱</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* 集合选择器 */}
            <select
              value={selectedCollectionId || ''}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">选择知识库</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.document_count} 篇)
                </option>
              ))}
            </select>

            {/* 视图切换 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewType('citation')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewType === 'citation'
                    ? 'bg-white text-gray-800 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                引用关系
              </button>
              <button
                onClick={() => setViewType('topic')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewType === 'topic'
                    ? 'bg-white text-gray-800 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                主题聚类
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">加载中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-red-500">
              <p>{error}</p>
              <button
                onClick={() => loadGraphData()}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                重试
              </button>
            </div>
          </div>
        ) : !selectedCollectionId ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg">请选择一个知识库</p>
              <p className="text-sm mt-2">选择知识库后可查看知识图谱</p>
            </div>
          </div>
        ) : viewType === 'citation' ? (
          citationData && (
            <CitationGraph
              data={citationData}
              showExternal={showExternal}
              onToggleExternal={handleToggleExternal}
              minCitations={minCitations}
              onChangeMinCitations={handleChangeMinCitations}
            />
          )
        ) : (
          topicData && <TopicClusterView data={topicData} />
        )}
      </div>

      {/* 底部统计 */}
      {stats && (
        <footer className="bg-white border-t px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex gap-6">
              <span>
                论文总数：<strong>{stats.paper_count}</strong>
              </span>
              <span>
                引用关系：<strong>{stats.citation_count}</strong>
              </span>
              <span>
                关键词数：<strong>{stats.keyword_count}</strong>
              </span>
            </div>
            <span className="text-gray-400">
              数据更新时间：{new Date().toLocaleString('zh-CN')}
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}

export default KnowledgeGraphPage
