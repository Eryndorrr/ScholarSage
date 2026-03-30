import { FileText } from 'lucide-react'
import type { Source } from '../../types/document'

interface SourceCardProps {
  source: Source
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="bg-white p-3 rounded-lg border-l-4 border-blue-500 shadow-sm">
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-blue-500 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{source.title}</div>
          <div className="text-xs text-gray-600 mt-1">
            第{source.page}页
          </div>
          <div className="text-xs text-gray-500 mt-2 line-clamp-2">
            {source.snippet}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            相关性: {(source.relevance_score * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  )
}