import { useCitations } from '../../hooks/usePapers'
import { BookOpen } from 'lucide-react'

interface CitationListProps {
  paperId: string
}

export function CitationList({ paperId }: CitationListProps) {
  const { data, isLoading, error } = useCitations(paperId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-4">
        加载失败: {error.message}
      </div>
    )
  }

  if (!data?.citations?.length) {
    return (
      <div className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg">
        <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">暂无引用信息</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        参考文献 ({data.total})
      </h4>
      <ul className="space-y-2 max-h-80 overflow-y-auto">
        {data.citations.map((citation) => (
          <li
            key={citation.id}
            className="p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            <p className="font-medium text-gray-900">
              {citation.cited_title || '未知标题'}
            </p>
            {citation.cited_authors.length > 0 && (
              <p className="text-gray-600 mt-1">
                {citation.cited_authors.join(', ')}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {citation.cited_year && <span>{citation.cited_year}</span>}
              {citation.cited_venue && <span>· {citation.cited_venue}</span>}
              {citation.location && <span>· {citation.location}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
