import { BookOpen, BarChart3 } from 'lucide-react'

interface HeaderProps {
  onEvaluationClick?: () => void
}

export function Header({ onEvaluationClick }: HeaderProps) {
  return (
    <header className="bg-white border-b px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-800">RAG 知识库</h1>
        </div>

        {onEvaluationClick && (
          <button
            onClick={onEvaluationClick}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-medium">效果评估</span>
          </button>
        )}
      </div>
    </header>
  )
}
