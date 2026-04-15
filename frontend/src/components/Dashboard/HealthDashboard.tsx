import { useState, useEffect } from 'react'
import {
  ChevronLeft, Activity, FileText, MessageSquare, BarChart3,
  Database, Clock, TrendingUp, AlertTriangle, CheckCircle,
  Loader2, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

interface HealthDashboardProps {
  onBack: () => void
}

interface CollectionHealth {
  collection_id: string
  collection_name: string
  health_score: number
  documents: { total: number; completed: number; failed: number; processing: number }
  queries: { total: number; avg_confidence: number | null; avg_response_time: number | null }
  evaluation: {
    total_evaluations: number
    latest_metrics: Record<string, any>
    trend: Array<{
      date: string | null
      faithfulness: number | null
      answer_relevancy: number | null
      context_precision: number | null
      execution_time: number | null
    }>
  }
  benchmark: { total: number; reviewed: number }
}

interface Overview {
  total_collections: number
  total_documents: number
  total_queries: number
  total_evaluations: number
  collections: Array<{
    id: string; name: string
    document_count: number; query_count: number; eval_count: number
  }>
}

export function HealthDashboard({ onBack }: HealthDashboardProps) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [healthData, setHealthData] = useState<CollectionHealth | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 加载概览和知识库列表
  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch('/api/dashboard/overview')
        if (res.ok) {
          const data = await res.json()
          setOverview(data)
          if (data.collections.length > 0) {
            setCollections(data.collections)
            setSelectedCollection(data.collections[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch overview:', e)
      }
    }
    fetchOverview()
  }, [])

  // 加载选中知识库的健康数据
  useEffect(() => {
    if (!selectedCollection) return
    loadHealth(selectedCollection)
  }, [selectedCollection])

  const loadHealth = async (collectionId: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/dashboard/collection/${collectionId}`)
      if (res.ok) {
        setHealthData(await res.json())
      }
    } catch (e) {
      toast.error('加载健康数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getMetricColor = (value: number | null | undefined) => {
    if (value == null) return 'text-gray-400'
    if (value >= 0.8) return 'text-green-600'
    if (value >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">知识库健康度</h1>
              <p className="text-sm text-gray-500">监控知识库状态和系统质量</p>
            </div>
          </div>
        </div>

        {selectedCollection && (
          <button
            onClick={() => loadHealth(selectedCollection)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        )}
      </div>

      {/* 系统概览 */}
      {overview && (
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={<Database className="w-5 h-5 text-blue-500" />} label="知识库" value={overview.total_collections} />
            <StatCard icon={<FileText className="w-5 h-5 text-green-500" />} label="文档总数" value={overview.total_documents} />
            <StatCard icon={<MessageSquare className="w-5 h-5 text-purple-500" />} label="查询总数" value={overview.total_queries} />
            <StatCard icon={<BarChart3 className="w-5 h-5 text-orange-500" />} label="评估次数" value={overview.total_evaluations} />
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧：知识库列表 */}
        <div className="w-64 bg-white border-r flex flex-col flex-shrink-0">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">选择知识库</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {collections.map(col => (
              <button
                key={col.id}
                onClick={() => setSelectedCollection(col.id)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${
                  selectedCollection === col.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-800 truncate">{col.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：健康度报告 */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : healthData ? (
            <div className="space-y-6">
              {/* 健康度评分 */}
              <div className={`rounded-lg border p-6 ${getScoreBg(healthData.health_score)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">健康度评分</h3>
                    <p className="text-sm text-gray-500">综合文档完整度、查询置信度和评估质量</p>
                  </div>
                  <div className={`text-5xl font-bold ${getScoreColor(healthData.health_score)}`}>
                    {healthData.health_score}
                  </div>
                </div>
                {/* 评分条 */}
                <div className="mt-4 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      healthData.health_score >= 80 ? 'bg-green-500' :
                      healthData.health_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${healthData.health_score}%` }}
                  />
                </div>
              </div>

              {/* 文档状态 */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  文档状态
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <MiniStat label="总数" value={healthData.documents.total} />
                  <MiniStat label="已完成" value={healthData.documents.completed} color="green" />
                  <MiniStat label="处理中" value={healthData.documents.processing} color="blue" />
                  <MiniStat label="失败" value={healthData.documents.failed} color="red" />
                </div>
              </div>

              {/* 查询统计 + 评估质量 */}
              <div className="grid grid-cols-2 gap-6">
                {/* 查询统计 */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                    查询统计
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">查询总数</span>
                      <span className="text-lg font-bold text-gray-900">{healthData.queries.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">平均置信度</span>
                      <span className={`text-lg font-bold ${getMetricColor(healthData.queries.avg_confidence)}`}>
                        {healthData.queries.avg_confidence != null
                          ? `${(healthData.queries.avg_confidence * 100).toFixed(1)}%`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">平均响应时间</span>
                      <span className="text-lg font-bold text-gray-900">
                        {healthData.queries.avg_response_time != null
                          ? `${healthData.queries.avg_response_time.toFixed(2)}s`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 最新评估 */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-orange-500" />
                    最新评估指标
                  </h3>
                  {healthData.evaluation.latest_metrics.faithfulness != null ? (
                    <div className="space-y-4">
                      <MetricBar
                        label="忠实度"
                        value={healthData.evaluation.latest_metrics.faithfulness}
                      />
                      <MetricBar
                        label="相关性"
                        value={healthData.evaluation.latest_metrics.answer_relevancy}
                      />
                      <MetricBar
                        label="精确度"
                        value={healthData.evaluation.latest_metrics.context_precision}
                      />
                      <div className="text-xs text-gray-400 mt-2">
                        评估次数: {healthData.evaluation.total_evaluations}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无评估数据</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 评估趋势 */}
              {healthData.evaluation.trend.length > 1 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    评估趋势
                  </h3>
                  <div className="space-y-3">
                    {healthData.evaluation.trend.map((t, i) => (
                      <div key={i} className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400 w-32 flex-shrink-0">
                          {t.date ? new Date(t.date).toLocaleDateString('zh-CN', {
                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                          }) : '-'}
                        </span>
                        <div className="flex-1 flex items-center gap-4">
                          <TrendMetric label="忠实" value={t.faithfulness} />
                          <TrendMetric label="相关" value={t.answer_relevancy} />
                          <TrendMetric label="精确" value={t.context_precision} />
                        </div>
                        {t.execution_time && (
                          <span className="text-gray-400 text-xs">{t.execution_time.toFixed(1)}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 基准集状态 */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  基准测试集
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">QA 对总数</span>
                    <span className="text-lg font-bold text-gray-900">{healthData.benchmark.total}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">已审核</span>
                    <span className="text-lg font-bold text-green-600">{healthData.benchmark.reviewed}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-500">知识库健康度</p>
                <p className="text-sm mt-2">选择一个知识库查看健康报告</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 子组件
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      {icon}
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
  }
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${color ? colorMap[color] || 'text-gray-900' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  )
}

function MetricBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null
  const pct = (value * 100).toFixed(1)
  const color = value >= 0.8 ? 'bg-green-500' : value >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TrendMetric({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return <span className="text-gray-300 text-xs">{label}: -</span>
  const color = value >= 0.8 ? 'text-green-600' : value >= 0.6 ? 'text-yellow-600' : 'text-red-600'
  return (
    <span className={`text-xs ${color}`}>
      {label}: {(value * 100).toFixed(0)}%
    </span>
  )
}
