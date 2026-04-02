import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface QueryInputProps {
  onSubmit: (question: string) => void
  disabled?: boolean
}

export function QueryInput({ onSubmit, disabled }: QueryInputProps) {
  const [question, setQuestion] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim() && !disabled) {
      onSubmit(question.trim())
      setQuestion('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="输入问题，按回车发送..."
        className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !question.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {disabled ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  )
}
