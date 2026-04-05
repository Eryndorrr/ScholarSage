import type { Evaluation } from '../../types/evaluation'
import type { QuestionResult } from '../../types/evaluation'
import {
  BarChart3,
  TrendingUp,
  Target,
  FileSearch,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react'
import { useState } from 'react'
import { QuestionDetailModal } from './QuestionDetailModal'

interface EvaluationResultsProps {
  evaluation: Evaluation
}

export function EvaluationResults({ evaluation }: EvaluationResultsProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [selectedResult, setSelectedResult] = useState<{ result: QuestionResult; index: number } | null>(null)

  if (!evaluation.metrics) {
    return (
      <div className="p-8 text-center text-gray-500">
        暂无评估指标数据
      </div>
    )
  }

  const metrics = evaluation.metrics

  // 指标配置
  const metricConfigs: Array<{
    key: 'faithfulness' | 'answer_relevancy' | 'context_precision' | 'context_recall',
    label: string,
    description: string,
    icon: typeof Target,
    color: string
  }> = [
    {
      key: 'faithfulness',
      label: '答案忠实度',
      description: '评估答案是否完全基于检索的上下文生成',
      icon: Target,
      color: 'blue'
    },
    {
      key: 'answer_relevancy',
      label: '答案相关性',
      description: '评估答案与问题的相关程度',
      icon: TrendingUp,
      color: 'green'
    },
    {
      key: 'context_precision',
      label: '上下文精确度',
      description: '评估检索到的上下文中有多少是真正相关的',
      icon: FileSearch,
      color: 'purple'
    },
    {
      key: 'context_recall',
      label: '上下文召回率',
      description: '评估相关的上下文有多少被检索到（需要ground truth）',
      icon: BarChart3,
      color: 'orange'
    }
  ]

  // 获取指标颜色
  const getMetricColor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'gray'
    if (value >= 0.8) return 'green'
    if (value >= 0.6) return 'yellow'
    return 'red'
  }

  // 获取进度条颜色类名
  const getBarColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      gray: 'bg-gray-300'
    }
    return colorMap[color] || 'bg-gray-300'
  }

  // 获取背景颜色类名
  const getBgColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-50',
      green: 'bg-green-50',
      purple: 'bg-purple-50',
      orange: 'bg-orange-50',
      gray: 'bg-gray-50'
    }
    return colorMap[color] || 'bg-gray-50'
  }

  return (
    <div className="p-4 space-y-4">
      {/* 汇总指标 */}
      <div className="grid grid-cols-2 gap-4">
        {metricConfigs.map(config => {
          const value = metrics[config.key]
          const color = getMetricColor(value)
          const Icon = config.icon

          return (
            <div
              key={config.key}
              className={`p-4 rounded-lg border ${getBgColorClass(color)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 text-${color === 'yellow' ? 'yellow' : color}-600`} />
                <span className="text-sm font-medium text-gray-700">{config.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold text-${color === 'yellow' ? 'yellow' : color}-600`}>
                  {value !== null && value !== undefined
                    ? (value * 100).toFixed(1)
                    : '-'}
                </span>
                {value !== null && value !== undefined && (
                  <span className="text-sm text-gray-500">%</span>
                )}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getBarColorClass(color)} transition-all duration-500`}
                  style={{ width: value ? `${value * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{config.description}</p>
            </div>
          )
        })}
      </div>

      {/* 评估统计 */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>执行时间: {evaluation.execution_time?.toFixed(1) || '-'}s</span>
        </div>
        <div className="flex items-center gap-1">
          <FileSearch className="w-4 h-4" />
          <span>问题数: {evaluation.total_questions}</span>
        </div>
      </div>

      {/* 详细结果 */}
      {evaluation.detailed_results && evaluation.detailed_results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">详细结果 ({evaluation.detailed_results.length} 个问题)</span>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {showDetails && (
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
              {evaluation.detailed_results.map((result, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedResult({ result, index })}
                  className="group p-3 bg-white border rounded-lg text-sm cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 mb-1 truncate">
                        Q{index + 1}: {result.question}
                      </div>
                      <div className="text-gray-500 line-clamp-1">
                        A: {result.answer}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex gap-3 text-xs mt-2">
                    {result.faithfulness !== null && result.faithfulness !== undefined && (
                      <span className="text-blue-600">
                        忠实度: {(result.faithfulness * 100).toFixed(0)}%
                      </span>
                    )}
                    {result.answer_relevancy !== null && result.answer_relevancy !== undefined && (
                      <span className="text-green-600">
                        相关性: {(result.answer_relevancy * 100).toFixed(0)}%
                      </span>
                    )}
                    {result.context_precision !== null && result.context_precision !== undefined && (
                      <span className="text-purple-600">
                        精确度: {(result.context_precision * 100).toFixed(0)}%
                      </span>
                    )}
                    {result.error && (
                      <span className="text-red-600">{result.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedResult && (
        <QuestionDetailModal
          result={selectedResult.result}
          index={selectedResult.index}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  )
}
