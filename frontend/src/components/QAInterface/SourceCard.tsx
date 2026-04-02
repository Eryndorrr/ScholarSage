import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { Source } from '../../types/document'

interface SourceCardProps {
  source: Source
  onPreview?: (source: Source) => void
}

export function SourceCard({ source, onPreview }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      {/* 头部 */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 p-3 cursor-pointer"
      >
        <div className="p-1.5 bg-white rounded border flex-shrink-0">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">
            {source.title}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">第 {source.page} 页</span>
            <span className="text-xs text-blue-500 font-medium">
              {(source.relevance_score * 100).toFixed(0)}% 匹配
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPreview(source)
              }}
              className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50"
              title="打开文档"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 展开的片段内容 */}
      {expanded && (
        <div className="px-3 pb-3">
          <div className="bg-white rounded-md p-3 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1.5 font-medium">引用片段</div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {source.snippet}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
