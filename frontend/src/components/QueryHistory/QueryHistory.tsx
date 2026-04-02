import { useState, useEffect } from 'react'
import { MessageSquare, Trash2, ChevronDown, ChevronUp, RefreshCw, Clock } from 'lucide-react'
import { historyService } from '../../services/historyService'
import type { QueryHistoryItem } from '../../types/queryHistory'

interface QueryHistoryProps {
  collectionId: string
  onRequery?: (question: string) => void
}

export function QueryHistory({ collectionId, onRequery }: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (collectionId) {
      loadHistory()
    }
  }, [collectionId])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const data = await historyService.getHistory(collectionId)
      setHistory(data.history || [])
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      await historyService.deleteItem(id)
      setHistory(history.filter(h => h.id !== id))
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确定要清空所有记录吗？')) return

    try {
      await historyService.clearHistory(collectionId)
      setHistory([])
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无查询记录</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-gray-500">{history.length} 条记录</span>
        <button
          onClick={handleClearAll}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          清空
        </button>
      </div>

      {history.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-lg border overflow-hidden"
        >
          {/* 问题部分 - 始终显示 */}
          <div
            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                  {item.question}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(item.query_time)}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  <span>{(item.confidence * 100).toFixed(0)}% 匹配</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {expandedId === item.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* 答案部分 - 展开时显示 */}
          {expandedId === item.id && (
            <div className="px-3 pb-3 border-t bg-gray-50">
              <div className="pt-3">
                <div className="text-xs font-medium text-gray-500 mb-1.5">回答</div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {item.answer}
                </p>

                {/* 来源 */}
                {item.sources && item.sources.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">
                      参考来源 ({item.sources.length})
                    </div>
                    <div className="space-y-1.5">
                      {item.sources.map((source, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-white p-2 rounded border"
                        >
                          <span className="font-medium text-gray-700">{source.title}</span>
                          <span className="text-gray-400 ml-1">
                            ({(source.relevance_score * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 重新提问按钮 */}
                {onRequery && (
                  <button
                    onClick={() => onRequery(item.question)}
                    className="mt-3 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新提问
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
