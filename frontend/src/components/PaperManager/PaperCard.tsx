import type { Paper } from '../../types/paper'
import { Calendar, BookOpen } from 'lucide-react'

interface PaperCardProps {
  paper: Paper
  selected?: boolean
  onSelect?: () => void
  onClick?: () => void
}

export function PaperCard({ paper, selected, onSelect, onClick }: PaperCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点击的是 checkbox 区域，不触发卡片点击
    if ((e.target as HTMLElement).closest('.checkbox-area')) {
      return
    }
    // 单击进入详情
    onClick?.()
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onSelect?.()
  }

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        {/* 选择框 */}
        {onSelect && (
          <div
            className="checkbox-area flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={handleCheckboxChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 cursor-pointer"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h3 className="font-medium text-gray-900 truncate" title={paper.title || '未命名论文'}>
            {paper.title || '未命名论文'}
          </h3>

          {/* 作者 */}
          {paper.authors.length > 0 && (
            <p className="text-sm text-gray-600 mt-1 truncate">
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ` 等${paper.authors.length}人`}
            </p>
          )}

          {/* 元信息 */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {paper.publication_year && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {paper.publication_year}
              </span>
            )}
            {paper.venue && (
              <span className="truncate max-w-[150px] flex items-center gap-1" title={paper.venue}>
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                {paper.venue}
              </span>
            )}
          </div>

          {/* 关键词 */}
          {paper.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {paper.keywords.slice(0, 3).map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                >
                  {keyword}
                </span>
              ))}
              {paper.keywords.length > 3 && (
                <span className="text-xs text-gray-400">+{paper.keywords.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
