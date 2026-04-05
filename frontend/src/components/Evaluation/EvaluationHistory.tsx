import { useState, useEffect } from 'react'
import { evaluationService } from '../../services/evaluationService'
import type { Evaluation } from '../../types/evaluation'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface EvaluationHistoryProps {
  collectionId: string
  onSelectEvaluation: (evaluation: Evaluation) => void
  refreshTrigger?: number
}

export function EvaluationHistory({ collectionId, onSelectEvaluation, refreshTrigger }: EvaluationHistoryProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    loadEvaluations()
  }, [collectionId, refreshTrigger])

  const loadEvaluations = async () => {
    try {
      setIsLoading(true)
      const response = await evaluationService.listEvaluations(collectionId)
      setEvaluations(response.evaluations)
    } catch (error) {
      console.error('Failed to load evaluations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, evaluationId: string) => {
    e.stopPropagation()
    if (!confirm('确定删除此评估记录？')) return

    try {
      await evaluationService.deleteEvaluation(evaluationId)
      setEvaluations(evaluations.filter(ev => ev.id !== evaluationId))
      toast.success('已删除')
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAverageScore = (evaluation: Evaluation) => {
    if (!evaluation.metrics) return null
    const scores = [
      evaluation.metrics.faithfulness,
      evaluation.metrics.answer_relevancy
    ].filter(v => v !== null && v !== undefined)
    if (scores.length === 0) return null
    return (scores.reduce((a, b) => a! + b!, 0)! / scores.length * 100).toFixed(0)
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Loader2 className="w-5 h-5 mx-auto animate-spin" />
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无评估记录</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* 标题栏 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">评估历史</span>
          <span className="text-sm text-gray-400">({evaluations.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* 历史列表 */}
      {isExpanded && (
        <div className="border-t divide-y max-h-96 overflow-y-auto">
          {evaluations.map((evaluation) => {
            const avgScore = getAverageScore(evaluation)

            return (
              <div
                key={evaluation.id}
                onClick={() => onSelectEvaluation(evaluation)}
                className="group flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {getStatusIcon(evaluation.status)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {formatTime(evaluation.created_at)}
                    </span>
                    {avgScore && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                        平均 {avgScore}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{evaluation.total_questions} 个问题</span>
                    {evaluation.execution_time && (
                      <span>{evaluation.execution_time.toFixed(1)}s</span>
                    )}
                    {evaluation.parameters?.top_k && (
                      <span>Top-{evaluation.parameters.top_k}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(e, evaluation.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
