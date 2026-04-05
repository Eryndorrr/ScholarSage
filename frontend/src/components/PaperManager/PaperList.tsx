import { useState } from 'react'
import { usePapers, useDeletePaper, useGenerateBibTeX } from '../../hooks/usePapers'
import { PaperCard } from './PaperCard'
import { PaperSearchBar } from './PaperSearchBar'
import { BibTeXModal } from './BibTeXModal'
import { FileText, CheckSquare, Square, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaperQueryParams } from '../../types/paper'

interface PaperListProps {
  collectionId: string | undefined
  onSelectPaper?: (paperId: string) => void
}

export function PaperList({ collectionId, onSelectPaper }: PaperListProps) {
  const [queryParams, setQueryParams] = useState<PaperQueryParams>({
    sort_by: 'created_at',
    sort_order: 'desc',
    page: 1,
    page_size: 20,
  })

  const { data, isLoading, error } = usePapers(collectionId, queryParams)
  const deleteMutation = useDeletePaper()
  const bibtexMutation = useGenerateBibTeX()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBibTeX, setShowBibTeX] = useState(false)
  const [bibtexContent, setBibtexContent] = useState<string[]>([])

  const toggleSelect = (paperId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(paperId)) {
      newSelected.delete(paperId)
    } else {
      newSelected.add(paperId)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (data?.papers) {
      if (selectedIds.size === data.papers.length) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(data.papers.map((p) => p.id)))
      }
    }
  }

  const handleSearch = (params: PaperQueryParams) => {
    setQueryParams({ ...params, page_size: queryParams.page_size })
    setSelectedIds(new Set()) // 清空选中
  }

  const handlePageChange = (newPage: number) => {
    setQueryParams({ ...queryParams, page: newPage })
    setSelectedIds(new Set()) // 清空选中
  }

  const handleExportBibTeX = async () => {
    if (selectedIds.size === 0) return

    const result = await bibtexMutation.mutateAsync(Array.from(selectedIds))
    setBibtexContent(result.bibtex_entries)
    setShowBibTeX(true)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    if (!confirm(`确定要删除 ${selectedIds.size} 篇论文吗？`)) return

    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id)
    }
    setSelectedIds(new Set())
  }

  if (!collectionId) {
    return (
      <div className="text-center text-gray-500 py-8 bg-white rounded-lg">
        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>请先选择一个知识库</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <PaperSearchBar onSearch={handleSearch} initialParams={queryParams} />

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-900"
          >
            {data?.papers && data.papers.length > 0 && selectedIds.size === data.papers.length ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            全选
          </button>
          <span className="text-sm text-gray-500">
            已选择 {selectedIds.size} 篇 / 共 {data?.total || 0} 篇
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBibTeX}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            导出BibTeX
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="text-center text-red-500 py-8 bg-white rounded-lg">
          加载失败: {error.message}
        </div>
      )}

      {/* 论文列表 */}
      {!isLoading && !error && data?.papers?.length === 0 ? (
        <div className="text-center text-gray-500 py-8 bg-white rounded-lg shadow">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>暂无论文</p>
          <p className="text-xs mt-1">上传PDF文档后可在此查看论文元数据</p>
        </div>
      ) : (
        !isLoading && !error && (
          <>
            <div className="space-y-3">
              {data?.papers?.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  selected={selectedIds.has(paper.id)}
                  onSelect={() => toggleSelect(paper.id)}
                  onClick={() => onSelectPaper?.(paper.id)}
                />
              ))}
            </div>

            {/* 分页 */}
            {data && data.total_pages && data.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4">
                <button
                  onClick={() => handlePageChange((queryParams.page || 1) - 1)}
                  disabled={(queryParams.page || 1) <= 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* 页码显示 */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, data.total_pages || 1) }, (_, i) => {
                    let pageNum: number
                    const currentPage = queryParams.page || 1
                    const totalPages = data.total_pages || 1

                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm ${
                          pageNum === currentPage
                            ? 'bg-blue-500 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => handlePageChange((queryParams.page || 1) + 1)}
                  disabled={(queryParams.page || 1) >= (data.total_pages || 1)}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* BibTeX弹窗 */}
      {showBibTeX && (
        <BibTeXModal
          entries={bibtexContent}
          onClose={() => setShowBibTeX(false)}
        />
      )}
    </div>
  )
}
