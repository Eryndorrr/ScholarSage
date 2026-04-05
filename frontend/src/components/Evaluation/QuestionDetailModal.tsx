import type { QuestionResult } from '../../types/evaluation'
import { X, FileText, MessageSquare, Target, TrendingUp, FileSearch, BarChart3, ExternalLink } from 'lucide-react'

interface QuestionDetailModalProps {
  result: QuestionResult
  index: number
  onClose: () => void
}

export function QuestionDetailModal({ result, index, onClose }: QuestionDetailModalProps) {
  // 获取指标颜色
  const getMetricColor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'text-gray-400'
    if (value >= 0.8) return 'text-green-600'
    if (value >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getMetricBgColor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'bg-gray-50'
    if (value >= 0.8) return 'bg-green-50'
    if (value >= 0.6) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            问题 #{index + 1} 详细结果
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 问题 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">问题</span>
            </div>
            <p className="text-gray-800 leading-relaxed">{result.question}</p>
          </div>

          {/* 答案 */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">答案</span>
            </div>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{result.answer}</p>
          </div>

          {/* 评估指标 */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-4 ${getMetricBgColor(result.faithfulness)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-600">答案忠实度</span>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(result.faithfulness)}`}>
                {result.faithfulness !== null && result.faithfulness !== undefined
                  ? `${(result.faithfulness * 100).toFixed(1)}%`
                  : '-'}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    result.faithfulness && result.faithfulness >= 0.8 ? 'bg-green-500' :
                    result.faithfulness && result.faithfulness >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: result.faithfulness ? `${result.faithfulness * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                评估答案是否完全基于检索的上下文生成
              </p>
            </div>

            <div className={`rounded-lg p-4 ${getMetricBgColor(result.answer_relevancy)}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-600">答案相关性</span>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(result.answer_relevancy)}`}>
                {result.answer_relevancy !== null && result.answer_relevancy !== undefined
                  ? `${(result.answer_relevancy * 100).toFixed(1)}%`
                  : '-'}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    result.answer_relevancy && result.answer_relevancy >= 0.8 ? 'bg-green-500' :
                    result.answer_relevancy && result.answer_relevancy >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: result.answer_relevancy ? `${result.answer_relevancy * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                评估答案与问题的相关程度
              </p>
            </div>

            <div className={`rounded-lg p-4 ${getMetricBgColor(result.context_precision)}`}>
              <div className="flex items-center gap-2 mb-2">
                <FileSearch className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-600">上下文精确度</span>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(result.context_precision)}`}>
                {result.context_precision !== null && result.context_precision !== undefined
                  ? `${(result.context_precision * 100).toFixed(1)}%`
                  : '-'}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    result.context_precision && result.context_precision >= 0.8 ? 'bg-green-500' :
                    result.context_precision && result.context_precision >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: result.context_precision ? `${result.context_precision * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                检索到的上下文中有多少是真正相关的
              </p>
            </div>

            <div className={`rounded-lg p-4 ${getMetricBgColor(result.context_recall)}`}>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-600">上下文召回率</span>
              </div>
              <div className={`text-2xl font-bold ${getMetricColor(result.context_recall)}`}>
                {result.context_recall !== null && result.context_recall !== undefined
                  ? `${(result.context_recall * 100).toFixed(1)}%`
                  : '-'}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    result.context_recall && result.context_recall >= 0.8 ? 'bg-green-500' :
                    result.context_recall && result.context_recall >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: result.context_recall ? `${result.context_recall * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                相关的上下文有多少被检索到
              </p>
            </div>
          </div>

          {/* 检索的上下文 */}
          {result.context_sources && result.context_sources.length > 0 ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">
                  检索的上下文 ({result.context_sources.length} 个片段)
                </span>
              </div>
              <div className="space-y-3">
                {result.context_sources.map((source, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {source.document_name || '未知文档'}
                        </span>
                        {source.page !== undefined && source.page >= 0 && (
                          <span className="text-xs text-gray-400">
                            第 {source.page} 页
                          </span>
                        )}
                        {source.chunk_index >= 0 && (
                          <span className="text-xs text-gray-400">
                            片段 #{source.chunk_index}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>相似度: {(1 - source.distance).toFixed(2)}</span>
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{source.content}</p>
                    {source.document_id && (
                      <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-gray-400">
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">ID: {source.document_id}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : result.contexts && result.contexts.length > 0 ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">
                  检索的上下文 ({result.contexts.length} 个片段)
                </span>
              </div>
              <div className="space-y-3">
                {result.contexts.map((context, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border text-sm">
                    <div className="text-xs text-gray-400 mb-1">片段 {i + 1}</div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{context}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 错误信息 */}
          {result.error && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <X className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">错误</span>
              </div>
              <p className="text-red-700">{result.error}</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
