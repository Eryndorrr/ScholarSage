import { useState, useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { QueryInput } from './QueryInput'
import { SourceCard } from './SourceCard'
import { useQuery } from '../../hooks/useQuery'
import type { Source } from '../../types/document'

interface ChatWindowProps {
  collectionId: string | null
  onQueryComplete?: () => void
}

interface Message {
  type: 'user' | 'ai'
  content: string
  sources?: Source[]
}

export function ChatWindow({ collectionId, onQueryComplete }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [previewSource, setPreviewSource] = useState<Source | null>(null)
  const { query, isLoading } = useQuery()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 监听来自历史记录的重新提问
  useEffect(() => {
    const handleRequery = (e: CustomEvent) => {
      const question = e.detail
      if (question) {
        handleQuery(question)
      }
    }
    window.addEventListener('requery', handleRequery as EventListener)
    return () => {
      window.removeEventListener('requery', handleRequery as EventListener)
    }
  }, [collectionId])

  const handleQuery = (question: string) => {
    setMessages((prev) => [...prev, { type: 'user', content: question }])

    query(
      {
        question,
        collection_id: collectionId || undefined
      },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              type: 'ai',
              content: response.answer,
              sources: response.sources,
            },
          ])
          onQueryComplete?.()
        },
      }
    )
  }

  const handleSourcePreview = (source: Source) => {
    setPreviewSource(source)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-500 mb-1">开始提问</p>
              <p className="text-sm">基于已上传的文档进行智能问答</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx}>
                <MessageBubble type={msg.type}>{msg.content}</MessageBubble>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      参考来源
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {msg.sources.map((source, sIdx) => (
                        <SourceCard
                          key={sIdx}
                          source={source}
                          onPreview={collectionId ? handleSourcePreview : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <MessageBubble type="ai">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-gray-500">思考中...</span>
                </div>
              </MessageBubble>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t p-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <QueryInput onSubmit={handleQuery} disabled={isLoading} />
        </div>
      </div>

      {/* 片段预览弹窗 */}
      {previewSource && collectionId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewSource(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-800">{previewSource.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">第 {previewSource.page} 页</p>
              </div>
              <button
                onClick={() => setPreviewSource(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {(previewSource.relevance_score * 100).toFixed(0)}% 匹配
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {previewSource.snippet}
                </p>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setPreviewSource(null)}
                className="w-full py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
