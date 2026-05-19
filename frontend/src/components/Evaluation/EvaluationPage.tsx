import { useState, useEffect, useCallback } from 'react'
import { evaluationService } from '../../services/evaluationService'
import { apiClient } from '../../services/api'
import type { Evaluation, EvaluationDetail } from '../../types/evaluation'
import {
  PlayCircle,
  Loader2,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Clock,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'

interface EvaluationPageProps {
  onBack: () => void
}

export function EvaluationPage({ onBack }: EvaluationPageProps) {
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationDetail | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [parameters, setParameters] = useState({
    top_k: 3
  })
  const [sampleSize, setSampleSize] = useState(5)
  const [customQuestions, setCustomQuestions] = useState<string[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [selectedHistory, setSelectedHistory] = useState<EvaluationDetail | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // 加载知识库列表
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await apiClient.get('/api/collections')
        const data = response.data
        // API 返回 { collections: [...] } 格式
        const collectionsList = data.collections || data || []
        setCollections(collectionsList)
        if (collectionsList.length > 0) {
          setSelectedCollection(collectionsList[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch collections:', error)
      }
    }
    fetchCollections()
  }, [])

  // 加载评估历史
  const loadEvaluations = useCallback(async () => {
    if (!selectedCollection) return
    setIsLoadingHistory(true)
    try {
      const response = await evaluationService.listEvaluations(selectedCollection)
      setEvaluations(response.evaluations)
    } catch (error) {
      console.error('Failed to load evaluations:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [selectedCollection])

  useEffect(() => {
    if (selectedCollection) {
      loadEvaluations()
    }
  }, [selectedCollection, loadEvaluations])

  // 启动评估
  const handleStartEvaluation = async () => {
    if (!selectedCollection) {
      toast.error('请先选择知识库')
      return
    }

    setIsRunning(true)
    setCurrentEvaluation(null)
    setSelectedHistory(null)

    try {
      const evaluation = await evaluationService.runEvaluation({
        collection_id: selectedCollection,
        parameters,
        sample_size: sampleSize,
        sample_questions: customQuestions.length > 0 ? customQuestions : undefined
      })

      setCurrentEvaluation(evaluation as EvaluationDetail)
      toast.success('评估任务已启动')
      pollEvaluationStatus(evaluation.id)
    } catch (error) {
      toast.error('启动评估失败: ' + (error as Error).message)
      setIsRunning(false)
    }
  }

  // 轮询评估状态
  const pollEvaluationStatus = async (evaluationId: string) => {
    const poll = async () => {
      try {
        const evaluation = await evaluationService.getEvaluation(evaluationId)
        setCurrentEvaluation(evaluation)

        if (evaluation.status === 'completed') {
          setIsRunning(false)
          toast.success('评估完成')
          loadEvaluations()
        } else if (evaluation.status === 'failed') {
          setIsRunning(false)
          toast.error('评估失败: ' + (evaluation.error_message || '未知错误'))
        } else {
          setTimeout(poll, 2000)
        }
      } catch (error) {
        console.error('Poll error:', error)
        setTimeout(poll, 2000)
      }
    }
    poll()
  }

  // 查看历史评估详情
  const handleViewHistory = async (evaluation: Evaluation) => {
    try {
      const detail = await evaluationService.getEvaluation(evaluation.id)
      setSelectedHistory(detail)
      setCurrentEvaluation(null)
    } catch {
      toast.error('获取评估详情失败')
    }
  }

  // 删除评估
  const handleDelete = async (e: React.MouseEvent, evaluationId: string) => {
    e.stopPropagation()
    if (!confirm('确定删除此评估记录？')) return

    try {
      await evaluationService.deleteEvaluation(evaluationId)
      setEvaluations(evaluations.filter(ev => ev.id !== evaluationId))
      if (selectedHistory?.id === evaluationId) {
        setSelectedHistory(null)
      }
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  const getAverageScore = (metrics: Evaluation['metrics']) => {
    if (!metrics) return null
    const scores = [metrics.faithfulness, metrics.answer_relevancy].filter(v => v != null)
    if (scores.length === 0) return null
    return ((scores.reduce((a, b) => a! + b!, 0)! / scores.length) * 100).toFixed(0)
  }

  // 当前显示的评估（正在进行的或选中的历史）
  const displayEvaluation = currentEvaluation || selectedHistory

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RAG 效果评估</h1>
              <p className="text-sm text-gray-500">评估检索增强生成系统的效果</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
          {showSettings ? '隐藏设置' : '参数设置'}
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 主内容 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧：知识库选择 + 历史记录 */}
        <div className="w-80 bg-white border-r flex flex-col flex-shrink-0">
          {/* 知识库选择 */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择知识库</label>
            <select
              value={selectedCollection || ''}
              onChange={(e) => {
                setSelectedCollection(e.target.value)
                setCurrentEvaluation(null)
                setSelectedHistory(null)
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择知识库</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 评估历史 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700">评估历史</h3>
            </div>

            {isLoadingHistory ? (
              <div className="p-4 text-center text-gray-500">
                <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              </div>
            ) : evaluations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无评估记录</p>
              </div>
            ) : (
              <div className="divide-y">
                {evaluations.map(ev => {
                  const avgScore = getAverageScore(ev.metrics)
                  return (
                    <div
                      key={ev.id}
                      onClick={() => handleViewHistory(ev)}
                      className={`group p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedHistory?.id === ev.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(ev.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {formatTime(ev.created_at)}
                            </span>
                            {avgScore && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                                {avgScore}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{ev.total_questions} 个问题</span>
                            {ev.execution_time && <span>{ev.execution_time.toFixed(1)}s</span>}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, ev.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：评估内容 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 参数设置 */}
          {showSettings && (
            <div className="bg-white border-b p-4 flex-shrink-0">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Top K（检索文档数）</label>
                  <select
                    value={parameters.top_k}
                    onChange={(e) => setParameters({ ...parameters, top_k: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value={1}>1</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">评估问题数量</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sampleSize}
                    onChange={(e) => setSampleSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">自定义问题（每行一个，可选）</label>
                <textarea
                  value={customQuestions.join('\n')}
                  onChange={(e) => setCustomQuestions(e.target.value.split('\n').filter(q => q.trim()))}
                  placeholder="留空则自动生成评估问题"
                  className="w-full px-3 py-2 border rounded text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* 评估内容区 */}
          <div className="flex-1 overflow-y-auto p-6">
            {displayEvaluation ? (
              <EvaluationResultsDisplay evaluation={displayEvaluation} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium text-gray-500">RAG 效果评估</p>
                  <p className="text-sm mt-2">选择知识库后点击"开始评估"</p>
                </div>
              </div>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="bg-white border-t px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    正在评估... ({currentEvaluation?.processed_questions || 0}/{currentEvaluation?.total_questions || 0})
                  </span>
                ) : customQuestions.length > 0 ? (
                  <span>已设置 {customQuestions.length} 个自定义问题，Top-{parameters.top_k} 检索</span>
                ) : (
                  <span>将自动生成 {sampleSize} 个评估问题，Top-{parameters.top_k} 检索</span>
                )}
              </div>
              <button
                onClick={handleStartEvaluation}
                disabled={isRunning || !selectedCollection}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    评估中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    开始评估
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 评估结果展示组件
function EvaluationResultsDisplay({ evaluation }: { evaluation: EvaluationDetail }) {
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null)

  const metrics = evaluation.metrics || {}

  const metricConfigs = [
    { key: 'faithfulness' as const, label: '答案忠实度', desc: '答案是否完全基于检索的上下文生成' },
    { key: 'answer_relevancy' as const, label: '答案相关性', desc: '答案与问题的相关程度' },
    { key: 'context_precision' as const, label: '上下文精确度', desc: '检索上下文中相关内容的比例' },
    { key: 'context_recall' as const, label: '上下文召回率', desc: '相关上下文被检索到的比例' }
  ]

  const getMetricColor = (value: number | null | undefined) => {
    if (value == null) return 'gray'
    if (value >= 0.8) return 'green'
    if (value >= 0.6) return 'yellow'
    return 'red'
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* 指标概览 */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">评估指标</h3>
        <div className="grid grid-cols-4 gap-4">
          {metricConfigs.map(config => {
            const value = metrics[config.key]
            const color = getMetricColor(value)
            return (
              <div key={config.key} className={`p-4 rounded-lg bg-${color}-50 border border-${color}-100`}>
                <div className="text-sm text-gray-600 mb-1">{config.label}</div>
                <div className={`text-2xl font-bold text-${color}-600`}>
                  {value != null ? `${(value * 100).toFixed(1)}%` : '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">{config.desc}</div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm text-gray-500">
          <span>问题数: {evaluation.total_questions}</span>
          {evaluation.execution_time && <span>耗时: {evaluation.execution_time.toFixed(1)}s</span>}
          <span>时间: {formatTime(evaluation.created_at)}</span>
        </div>
      </div>

      {/* 详细结果 */}
      {evaluation.detailed_results && evaluation.detailed_results.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">详细结果</h3>
          </div>
          <div className="divide-y">
            {evaluation.detailed_results.map((result, index) => (
              <div key={index} className="p-4">
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedQuestion(expandedQuestion === index ? null : index)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                      <span className="text-gray-900">{result.question}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {result.faithfulness != null && (
                        <span className="text-blue-600">忠实度: {(result.faithfulness * 100).toFixed(0)}%</span>
                      )}
                      {result.answer_relevancy != null && (
                        <span className="text-green-600">相关性: {(result.answer_relevancy * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  {expandedQuestion === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>

                {expandedQuestion === index && (
                  <div className="mt-4 space-y-4">
                    {/* 问题 */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-xs font-medium text-blue-600 mb-2">问题</div>
                      <div className="text-sm text-gray-900 font-medium">{result.question}</div>
                    </div>

                    {/* 答案 */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-xs font-medium text-green-600 mb-2">答案</div>
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <ReactMarkdown>{result.answer}</ReactMarkdown>
                      </div>
                    </div>

                    {/* 评估指标 */}
                    <div className="grid grid-cols-2 gap-3">
                      {result.faithfulness != null && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-xs text-blue-600 mb-1">答案忠实度</div>
                          <div className="text-lg font-bold text-blue-700">
                            {(result.faithfulness * 100).toFixed(1)}%
                          </div>
                          <div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${result.faithfulness * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {result.answer_relevancy != null && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs text-green-600 mb-1">答案相关性</div>
                          <div className="text-lg font-bold text-green-700">
                            {(result.answer_relevancy * 100).toFixed(1)}%
                          </div>
                          <div className="mt-1 h-1.5 bg-green-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${result.answer_relevancy * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {result.context_precision != null && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="text-xs text-purple-600 mb-1">上下文精确度</div>
                          <div className="text-lg font-bold text-purple-700">
                            {(result.context_precision * 100).toFixed(1)}%
                          </div>
                          <div className="mt-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${result.context_precision * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 上下文来源 */}
                    {result.context_sources && result.context_sources.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-xs font-medium text-gray-600 mb-3">
                          检索的上下文 ({result.context_sources.length} 个片段)
                        </div>
                        <div className="space-y-3">
                          {result.context_sources.map((source, i) => (
                            <div key={i} className="bg-white rounded-lg border p-4 text-sm">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    {source.document_name || '未知文档'}
                                  </span>
                                  {source.page != null && source.page >= 0 && (
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                      第 {source.page} 页
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">
                                  相似度: {((1 - source.distance) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="prose prose-sm max-w-none text-gray-600">
                                <ReactMarkdown>{source.content}</ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 错误信息 */}
                    {result.error && (
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <div className="text-xs font-medium text-red-600 mb-2">错误</div>
                        <div className="text-sm text-red-700">{result.error}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
