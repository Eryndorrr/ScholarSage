import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { Source } from '../../types/document'

interface SourceCardProps {
  source: Source
  index?: number           // 来源序号（从 1 开始）
  highlighted?: boolean    // 是否高亮
  onPreview?: (source: Source) => void
}

export function SourceCard({ source, index, highlighted, onPreview }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-lg border transition-all duration-300 ${
        highlighted
          ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50'
          : 'border-gray-200 bg-gray-50 hover:border-blue-300'
      }`}
    >
      {/* 头部 */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 p-3 cursor-pointer"
      >
        {/* 序号标签 */}
        {index !== undefined && (
          <span className={`flex-shrink-0 inline-flex items-center justify-center
                         min-w-[24px] h-[24px] px-1
                         text-xs font-mono font-medium rounded
                         ${highlighted
                           ? 'bg-blue-500 text-white'
                           : 'bg-gray-200 text-gray-600'
                         } align-middle`}
          >
            {index}
          </span>
        )}

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
