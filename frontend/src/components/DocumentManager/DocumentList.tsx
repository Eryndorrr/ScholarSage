import { useState, useEffect, useMemo } from 'react'
import { FileText, Trash2, Loader2, CheckCircle, XCircle, Clock, Eye, BookOpen, ChevronDown, Zap, Brain, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Document } from '../../types/document'
import { paperService } from '../../services/paperService'

interface DocumentListProps {
  documents: Document[]
  collectionId: string
  onDelete: (documentId: string) => void
  onPreview: (document: Document) => void
  onRefresh?: () => void  // 刷新文档列表的回调
}

export function DocumentList({ documents, onDelete, onPreview, onRefresh }: DocumentListProps) {
  const [parsingDocs, setParsingDocs] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 前端过滤
  const filteredDocuments = useMemo(() =>
    documents.filter(d =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [documents, searchQuery]
  )

  // 从 documents 中获取已解析状态
  const isParsed = (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    return doc?.has_paper || false
  }

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pdf: 'text-red-500 bg-red-50 dark:bg-red-900/30',
      docx: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
      md: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
      txt: 'text-gray-500 bg-gray-100 dark:bg-gray-700',
    }
    return colors[type] || 'text-gray-500 bg-gray-100 dark:bg-gray-700'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-400" />
      case 'processing':
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string, chunkCount: number, progress: number) => {
    switch (status) {
      case 'pending':
        return '排队中'
      case 'processing':
        return `处理中 ${progress}%`
      case 'completed':
        return `${chunkCount} 片段`
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        暂无文档
      </div>
    )
  }

  const handleParsePaper = async (docId: string, useLlm: boolean = false) => {
    // 如果已经解析过，询问是否覆盖
    if (isParsed(docId)) {
      const modeText = useLlm ? '智能解析' : '快速解析'
      if (!confirm(`该论文已解析过，是否使用「${modeText}」重新解析？\n\n重新解析将覆盖原有数据。`)) {
        setOpenMenuId(null)
        return
      }
    }

    setParsingDocs(prev => new Set(prev).add(docId))
    setOpenMenuId(null)

    const modeText = useLlm ? '智能解析' : '快速解析'
    const loadingToast = toast.loading(`正在${modeText}论文...`)

    try {
      // 如果已解析过，传入 force=true 强制重新解析
      await paperService.parsePaper(docId, useLlm, isParsed(docId))
      toast.success(`${modeText}完成！`, { id: loadingToast })
      // 刷新文档列表以更新 has_paper 状态
      onRefresh?.()
    } catch (error) {
      console.error('Failed to parse paper:', error)
      toast.error(`${modeText}失败，请重试`, { id: loadingToast })
    } finally {
      setParsingDocs(prev => {
        const newSet = new Set(prev)
        newSet.delete(docId)
        return newSet
      })
    }
  }

  const handleToggleMenu = (docId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setOpenMenuId(openMenuId === docId ? null : docId)
  }

  return (
    <div className="space-y-2">
      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索文档..."
          className="w-full pl-9 pr-8 py-2 text-sm border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          {searchQuery ? '无匹配结果' : '暂无文档'}
        </div>
      ) : (
        filteredDocuments.map((doc) => (
        <div
          key={doc.id}
          className="group bg-white dark:bg-gray-800 rounded-lg p-3 border dark:border-gray-700 hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded ${getFileTypeColor(doc.file_type)}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate cursor-default" title={doc.title}>
                {doc.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatFileSize(doc.file_size)}</span>
                <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                <div className="flex items-center gap-1">
                  {getStatusIcon(doc.status)}
                  <span>{getStatusText(doc.status, doc.chunk_count, doc.progress || 0)}</span>
                </div>
              </div>
              {/* 进度条 */}
              {doc.status === 'processing' && (
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${doc.progress || 0}%` }}
                  />
                </div>
              )}
              {doc.status === 'failed' && doc.error_message && (
                <p className="text-xs text-red-500 mt-1 truncate">
                  {doc.error_message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* 解析论文按钮 - 仅 PDF 且已完成时显示 */}
              {doc.file_type === 'pdf' && doc.status === 'completed' && (
                <div className="relative">
                  <div className="flex items-center">
                    {isParsed(doc.id) && (
                      <span className="p-1.5 text-green-500" title="已解析">
                        <CheckCircle className="w-4 h-4" />
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleParsePaper(doc.id, false)
                      }}
                      disabled={parsingDocs.has(doc.id)}
                      className={`p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 ${
                        isParsed(doc.id) ? '' : 'rounded-l'
                      }`}
                      title={isParsed(doc.id) ? '重新快速解析' : '快速解析（规则解析）'}
                    >
                      {parsingDocs.has(doc.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => handleToggleMenu(doc.id, e)}
                      disabled={parsingDocs.has(doc.id)}
                      className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-r transition-colors disabled:opacity-50 border-l border-gray-200 dark:border-gray-600"
                      title="选择解析模式"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  {/* 下拉菜单 */}
                  {openMenuId === doc.id && (
                    <div
                      className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[160px] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleParsePaper(doc.id, false)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                      >
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="font-medium">快速解析</div>
                          <div className="text-xs text-gray-400">规则解析，速度快</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleParsePaper(doc.id, true)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                      >
                        <Brain className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="font-medium">智能解析</div>
                          <div className="text-xs text-gray-400">LLM 解析，更准确</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => onPreview(doc)}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                title="预览"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(doc.id)}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )))}
    </div>
  )
}
