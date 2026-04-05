import type { ReactNode } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MessageBubbleProps {
  type: 'user' | 'ai'
  children: ReactNode
}

export function MessageBubble({ type, children }: MessageBubbleProps) {
  const isUser = type === 'user'

  // 将 children 转换为字符串
  const content = typeof children === 'string' ? children : ''

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        <div className="text-sm leading-relaxed">
          {isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>
      </div>
    </div>
  )
}
