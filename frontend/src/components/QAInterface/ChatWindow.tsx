import { useState, useEffect, useRef } from 'react'
import { Globe, GlobeOff } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { QueryInput } from './QueryInput'
import { SourceCard } from './SourceCard'
import { useQuery } from '../../hooks/useQuery'
import type { Source } from '../../types/document'
import type { SessionMessage } from '../../types/session'
import type { WebSearchResult } from '../../types/query'

interface ChatWindowProps {
  collectionId: string | null
  sessionId: string | null
  sessionMessages: SessionMessage[]
  sessionTitle: string | null
  webSearchEnabled?: boolean
  onQueryComplete: () => void
  onUpdateTitle?: (title: string) => void
  onToggleWebSearch?: (enabled: boolean) => void
}

interface Message {
  type: 'user' | 'ai'
  content: string
  sources?: Source[]
  webSearchResults?: WebSearchResult[]
}

export function ChatWindow({
  collectionId,
  sessionId,
  sessionMessages,
  sessionTitle,
  webSearchEnabled = false,
  onQueryComplete,
  onUpdateTitle,
  onToggleWebSearch
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [previewSource, setPreviewSource] = useState<Source | null>(null)
  const { query, isLoading } = useQuery()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isFirstQuery = useRef(true)

  // 同步 session 消息到本地状态
  useEffect(() => {
    const convertedMessages: Message[] = []
    for (const msg of sessionMessages) {
      convertedMessages.push({
        type: msg.role as 'user' | 'ai',
        content: msg.content,
        sources: msg.sources ? JSON.parse(msg.sources) : undefined
      })
    }
    setMessages(convertedMessages)
    isFirstQuery.current = sessionMessages.length === 0
  }, [sessionMessages])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 监听重新提问
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
  }, [collectionId, sessionId, webSearchEnabled])

  const handleQuery = (question: string) => {
    setMessages((prev) => [...prev, { type: 'user', content: question }])

    query(
      {
        question,
        collection_id: collectionId || undefined,
        session_id: sessionId || undefined,
        web_search_enabled: webSearchEnabled
      },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              type: 'ai',
              content: response.answer,
              sources: response.sources,
              webSearchResults: response.web_search_results,
            },
          ])

          // 第一次提问时更新标题
          if (isFirstQuery.current && onUpdateTitle) {
            const title = question.length > 20 ? question.slice(0, 20) + '...' : question
            onUpdateTitle(title)
            isFirstQuery.current = false
          }

          onQueryComplete()
        },
      }
    )
  }

  const handleSourcePreview = (source: Source) => {
    setPreviewSource(source)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部工具栏 */}
      {(sessionTitle || onToggleWebSearch) && (
        <div className="border-b px-4 py-2 bg-white flex items-center justify-between">
          <div className="text-sm text-gray-500 truncate">
            {sessionTitle || '新对话'}
          </div>

          {/* 联网检索开关 */}
          {onToggleWebSearch && (
            <button
              onClick={() => onToggleWebSearch(!webSearchEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                webSearchEnabled
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={webSearchEnabled ? '联网检索已开启' : '联网检索已关闭'}
            >
              {webSearchEnabled ? (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  联网检索
                </>
              ) : (
                <>
                  <GlobeOff className="w-3.5 h-3.5" />
                  仅知识库
                </>
              )}
            </button>
          )}
        </div>
      )}

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
              <p className="text-lg font-medium text-gray-500 mb-1">开始对话</p>
              <p className="text-sm">基于已上传的文档进行智能问答</p>
              {webSearchEnabled && (
                <p className="text-xs text-blue-500 mt-2">
                  🔍 联网检索已开启，将同时搜索网络资源
                </p>
              )}
              {sessionTitle && (
                <p className="text-xs text-gray-400 mt-2">当前对话：{sessionTitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx}>
                <MessageBubble type={msg.type}>{msg.content}</MessageBubble>

                {/* 网络搜索结果 */}
                {msg.webSearchResults && msg.webSearchResults.length > 0 && (
                  <div className="mt-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600">网络搜索结果</span>
                    </div>
                    <div className="space-y-1.5">
                      {msg.webSearchResults.map((result, sIdx) => (
                        <a
                          key={sIdx}
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600 font-medium flex-1 truncate">
                              {result.title}
                            </span>
                            {result.source && (
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                {result.source}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">
                            {result.snippet}
                          </p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 本地知识库来源 */}
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
                  <span className="text-gray-500">
                    {webSearchEnabled ? '搜索中...' : '思考中...'}
                  </span>
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
          <QueryInput onSubmit={handleQuery} disabled={isLoading || !collectionId} />
          {webSearchEnabled && (
            <div className="text-xs text-center text-blue-500 mt-2">
              🔍 联网检索已开启 · 回答将参考网络资源
            </div>
          )}
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
