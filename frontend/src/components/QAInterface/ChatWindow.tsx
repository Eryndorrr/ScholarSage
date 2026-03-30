import { useState, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { QueryInput } from './QueryInput'
import { SourceCard } from './SourceCard'
import { useQuery } from '../../hooks/useQuery'

interface ChatWindowProps {
  collectionId: string | null
  onQueryComplete?: () => void
}

interface Message {
  type: 'user' | 'ai'
  content: string
  sources?: any[]
}

export function ChatWindow({ collectionId, onQueryComplete }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const { query, isLoading } = useQuery()

  // 监听来自历史记录的问题选择
  useEffect(() => {
    const handleSetQuery = (e: CustomEvent) => {
      const question = e.detail
      if (question) {
        handleQuery(question)
      }
    }
    window.addEventListener('setQuery', handleSetQuery as EventListener)
    return () => {
      window.removeEventListener('setQuery', handleSetQuery as EventListener)
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
          // 通知父组件查询完成，刷新历史
          onQueryComplete?.()
        },
      }
    )
  }

  return (
    <div className="flex flex-col h-[600px] bg-gray-50 rounded-lg">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <MessageBubble type={msg.type}>{msg.content}</MessageBubble>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="text-xs font-semibold text-gray-600 mb-2">
                  参考来源:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {msg.sources.map((source, sIdx) => (
                    <SourceCard key={sIdx} source={source} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <MessageBubble type="ai">思考中...</MessageBubble>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <QueryInput onSubmit={handleQuery} disabled={isLoading} />
      </div>
    </div>
  )
}