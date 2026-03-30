import type { ReactNode } from 'react'

interface MessageBubbleProps {
  type: 'user' | 'ai'
  children: ReactNode
}

export function MessageBubble({ type, children }: MessageBubbleProps) {
  const isUser = type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          isUser
            ? 'bg-blue-100 text-blue-900'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="font-semibold text-xs mb-1">
          {isUser ? '你' : 'AI'}
        </div>
        <div className="text-sm whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  )
}