import { useState, useEffect } from 'react'
import { MessageSquare, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { historyService } from '../../services/historyService'
import type { QueryHistoryItem } from '../../types/queryHistory'

interface QueryHistoryProps {
  collectionId: string
  onSelectQuery?: (question: string) => void
}

export function QueryHistory({ collectionId, onSelectQuery }: QueryHistoryProps) {
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
      setHistory(data.history)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这条查询记录吗？')) return

    try {
      await historyService.deleteItem(id)
      setHistory(history.filter(h => h.id !== id))
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确定要清空所有查询记录吗？')) return

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
    return <div className="text-center py-4 text-gray-500">加载中...</div>
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>暂无查询记录</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700">查询历史 ({history.length})</h3>
        <button
          onClick={handleClearAll}
          className="text-xs text-red-500 hover:text-red-700"
        >
          清空
        </button>
      </div>

      {history.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
        >
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {item.question}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatTime(item.query_time)}</span>
                <span>·</span>
                <span>{(item.response_time * 1000).toFixed(0)}ms</span>
                <span>·</span>
                <span>置信度 {(item.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {expandedId === item.id ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
              <button
                onClick={(e) => handleDelete(item.id, e)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expandedId === item.id && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {item.answer}
              </p>
              {item.sources.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">参考来源:</p>
                  <div className="space-y-1">
                    {item.sources.map((source, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-600 bg-gray-50 p-2 rounded"
                      >
                        <span className="font-medium">{source.title}</span>
                        <span className="text-gray-400 ml-2">
                          ({(source.relevance_score * 100).toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {onSelectQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectQuery(item.question)
                  }}
                  className="mt-3 text-xs text-blue-500 hover:text-blue-700"
                >
                  重新提问
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
