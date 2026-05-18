import { useState, useEffect, useRef } from 'react'
import { Globe, GlobeOff, Send, Square } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
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
  id: string
  type: 'user' | 'ai'
  content: string
  sources?: Source[]
  webSearchResults?: WebSearchResult[]
  isStreaming?: boolean
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
  const [inputValue, setInputValue] = useState('')
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null)
  const { queryStream, abort, isLoading } = useQuery()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isFirstQuery = useRef(true)

  // 处理引用点击
  const handleCitationClick = (index: number) => {
    // 设置高亮
    setHighlightedCitation(index)
    // 3秒后取消高亮
    setTimeout(() => setHighlightedCitation(null), 3000)

    // 滚动到对应的来源卡片
    const sourceElement = document.getElementById(`source-${index}`)
    if (sourceElement) {
      sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // 同步 session 消息到本地状态
  useEffect(() => {
    const convertedMessages: Message[] = []
    for (const msg of sessionMessages) {
      let sources: Source[] | undefined
      let webSearchResults: WebSearchResult[] | undefined

      try {
        sources = msg.sources ? JSON.parse(msg.sources) : undefined
      } catch {
        console.warn('Failed to parse sources for message:', msg.id)
        sources = undefined
      }

      try {
        webSearchResults = msg.web_search_results ? JSON.parse(msg.web_search_results) : undefined
      } catch {
        console.warn('Failed to parse web_search_results for message:', msg.id)
        webSearchResults = undefined
      }

      convertedMessages.push({
        id: `msg-${Date.now()}-${Math.random()}`,
        type: msg.role as 'user' | 'ai',
        content: msg.content,
        sources,
        webSearchResults
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
    // 添加用户消息
    const userMsgId = `user-${Date.now()}`
    const aiMsgId = `ai-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, type: 'user', content: question },
      { id: aiMsgId, type: 'ai', content: '', isStreaming: true }
    ])

    // 使用流式查询
    queryStream(
      {
        question,
        collection_id: collectionId || undefined,
        session_id: sessionId || undefined,
        web_search_enabled: webSearchEnabled
      },
      {
        onContent: (text) => {
          // 追加内容到 AI 消息
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: msg.content + text }
                : msg
            )
          )
        },
        onSources: (sources) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, sources }
                : msg
            )
          )
        },
        onWebResults: (webSearchResults) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, webSearchResults }
                : msg
            )
          )
        },
        onDone: () => {
          // 标记流式结束
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, isStreaming: false }
                : msg
            )
          )

          // 第一次提问时更新标题
          if (isFirstQuery.current && onUpdateTitle) {
            const title = question.length > 20 ? question.slice(0, 20) + '...' : question
            onUpdateTitle(title)
            isFirstQuery.current = false
          }

          onQueryComplete()
        },
        onError: (error) => {
          console.error('Query error:', error)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: `抱歉，发生了错误：${error}`, isStreaming: false }
                : msg
            )
          )
        }
      }
    )
  }

  const handleStop = () => {
    abort()
    // 更新当前正在流式输出的消息状态
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    )
  }

  const handleSourcePreview = (source: Source) => {
    setPreviewSource(source)
  }

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading || !collectionId) return
    handleQuery(inputValue.trim())
    setInputValue('')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full">
      {/* 顶部工具栏 */}
      {sessionTitle && (
        <div className="border-b dark:border-gray-700 px-4 py-2 bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {sessionTitle}
          </div>
        </div>
      )}

      {/* 消息区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">开始对话</p>
              <p className="text-sm">基于已上传的文档进行智能问答</p>
              {webSearchEnabled && (
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                  🔍 联网检索已开启，将同时搜索网络资源
                </p>
              )}
              {sessionTitle && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">当前对话：{sessionTitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble type={msg.type} onCitationClick={handleCitationClick}>
                  {msg.content || (msg.isStreaming && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-gray-500 dark:text-gray-400">
                        {webSearchEnabled ? '搜索中...' : '思考中...'}
                      </span>
                    </div>
                  ))}
                </MessageBubble>

                {/* 本地知识库来源 */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 mb-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      参考来源
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {msg.sources.map((source, sIdx) => (
                        <div id={`source-${sIdx + 1}`} key={sIdx}>
                          <SourceCard
                            source={source}
                            index={sIdx + 1}
                            highlighted={highlightedCitation === sIdx + 1}
                            onPreview={collectionId ? handleSourcePreview : undefined}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 网络搜索结果 */}
                {msg.webSearchResults && msg.webSearchResults.length > 0 && (
                  <div className="mt-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">网络搜索结果</span>
                    </div>
                    <div className="space-y-1.5">
                      {msg.webSearchResults.map((result, sIdx) => {
                        const webIndex = -(sIdx + 1) // W1 -> -1, W2 -> -2
                        return (
                          <a
                            key={sIdx}
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            id={`source-${webIndex}`}
                            className={`block p-2 rounded-lg text-sm transition-colors ${
                              highlightedCitation === webIndex
                                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-300 dark:ring-green-600'
                                : 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0 inline-flex items-center justify-center
                                             min-w-[24px] h-[24px] px-1
                                             text-xs font-mono font-medium rounded
                                             bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                W{sIdx + 1}
                              </span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium flex-1 truncate">
                                {result.title}
                              </span>
                              {result.source && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                  {result.source}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5 ml-8 line-clamp-2">
                              {result.snippet}
                            </p>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            {/* 联网检索开关 */}
            {onToggleWebSearch && (
              <button
                onClick={() => onToggleWebSearch(!webSearchEnabled)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                  webSearchEnabled
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title={webSearchEnabled ? '联网检索已开启' : '联网检索已关闭'}
              >
                {webSearchEnabled ? (
                  <>
                    <Globe className="w-4 h-4" />
                    <span className="hidden sm:inline">联网</span>
                  </>
                ) : (
                  <>
                    <GlobeOff className="w-4 h-4" />
                    <span className="hidden sm:inline">知识库</span>
                  </>
                )}
              </button>
            )}

            {/* 输入框 */}
            <form onSubmit={handleQuerySubmit} className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={webSearchEnabled ? "输入问题，将搜索知识库和网络..." : "输入问题，按回车发送..."}
                className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-800 dark:text-gray-200"
                disabled={isLoading || !collectionId}
              />
              <button
                type={isLoading ? 'button' : 'submit'}
                onClick={isLoading ? handleStop : undefined}
                disabled={!isLoading && (!inputValue.trim() || !collectionId)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                  isLoading
                    ? 'text-white bg-red-500 hover:bg-red-600'
                    : 'text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed'
                }`}
                title={isLoading ? '停止生成' : '发送'}
              >
                {isLoading ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 片段预览弹窗 */}
      {previewSource && collectionId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewSource(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{previewSource.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">第 {previewSource.page} 页</p>
              </div>
              <button
                onClick={() => setPreviewSource(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                    {(previewSource.relevance_score * 100).toFixed(0)}% 匹配
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {previewSource.snippet}
                </p>
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 rounded-b-xl">
              <button
                onClick={() => setPreviewSource(null)}
                className="w-full py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 text-sm font-medium transition-colors"
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
