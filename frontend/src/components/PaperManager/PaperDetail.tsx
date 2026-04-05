import { useState } from 'react'
import { usePaper } from '../../hooks/usePapers'
import { CitationList } from './CitationList'
import { PaperEditModal } from './PaperEditModal'
import {
  Calendar, BookOpen, Hash, ExternalLink, X, Edit2,
  ChevronDown, ChevronUp, Copy, Check, FileText,
  User, Tag, FileText as AbstractIcon, Quote
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PaperDetailProps {
  paperId: string
  onClose?: () => void
}

export function PaperDetail({ paperId, onClose }: PaperDetailProps) {
  const { data: paper, isLoading, error, refetch } = usePaper(paperId)
  const [showEditModal, setShowEditModal] = useState(false)
  const [abstractExpanded, setAbstractExpanded] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success('已复制')
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  // 复制 BibTeX 格式
  const copyBibTeX = () => {
    if (!paper) return

    const bibTeX = `@article{${paper.id.slice(0, 8)},
  title = {${paper.title || 'Unknown'}},
  author = {${paper.authors.join(' and ') || 'Unknown'}},
  year = {${paper.publication_year || ''}},
  journal = {${paper.venue || ''}},
  doi = {${paper.doi || ''}}
}`
    copyToClipboard(bibTeX, 'bibtex')
  }

  // 复制引用格式
  const copyCitation = () => {
    if (!paper) return

    const authors = paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown'
    const year = paper.publication_year ? ` (${paper.publication_year})` : ''
    const title = paper.title || 'Unknown'
    const venue = paper.venue ? `. ${paper.venue}` : ''

    const citation = `${authors}${year}. ${title}${venue}.`
    copyToClipboard(citation, 'citation')
  }

  // 摘要是否需要折叠（超过 300 字符）
  const shouldTruncateAbstract = paper?.abstract && paper.abstract.length > 300
  const displayAbstract = abstractExpanded || !shouldTruncateAbstract
    ? paper?.abstract
    : paper?.abstract?.slice(0, 300) + '...'

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="text-center text-red-500 py-8 bg-white rounded-lg shadow">
        加载失败: {error?.message || '论文不存在'}
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* 头部 - 渐变背景 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">
                    {paper.title || '未命名论文'}
                  </h1>
                  <button
                    onClick={() => copyToClipboard(paper.title || '', 'title')}
                    className="mt-1 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white/50 rounded transition-colors flex-shrink-0"
                    title="复制标题"
                  >
                    {copiedField === 'title' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {paper.authors.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{paper.authors.join(', ')}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* 快捷操作 */}
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={copyCitation}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white/50 rounded-lg transition-colors"
                    title="复制引用格式"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                  <button
                    onClick={copyBibTeX}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      copiedField === 'bibtex'
                        ? 'text-green-600 bg-green-100'
                        : 'text-gray-600 bg-white/50 hover:bg-white hover:text-blue-600'
                    }`}
                    title="复制 BibTeX"
                  >
                    {copiedField === 'bibtex' ? '已复制' : 'BibTeX'}
                  </button>
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white/50 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 基本信息卡片 */}
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">基本信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 发表年份 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs">年份</span>
              </div>
              <p className="text-sm font-medium text-gray-900">
                {paper.publication_year || '-'}
              </p>
            </div>

            {/* 发表 venue */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-xs">发表于</span>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate" title={paper.venue || '-'}>
                {paper.venue || '-'}
              </p>
            </div>

            {/* 引用数 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-xs">参考文献</span>
              </div>
              <p className="text-sm font-medium text-gray-900">
                {paper.citations_count}
              </p>
            </div>

            {/* DOI */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Hash className="w-3.5 h-3.5" />
                <span className="text-xs">DOI</span>
              </div>
              {paper.doi ? (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">{paper.doi}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ) : (
                <p className="text-sm font-medium text-gray-400">-</p>
              )}
            </div>
          </div>

          {/* 关键词 */}
          {paper.keywords.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Tag className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">关键词</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {paper.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-100"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 摘要 */}
        {paper.abstract && (
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-gray-500">
                <AbstractIcon className="w-3.5 h-3.5" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">摘要</h3>
              </div>
              <button
                onClick={() => copyToClipboard(paper.abstract || '', 'abstract')}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                title="复制摘要"
              >
                {copiedField === 'abstract' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {displayAbstract}
              </p>
              {shouldTruncateAbstract && (
                <button
                  onClick={() => setAbstractExpanded(!abstractExpanded)}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  {abstractExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      收起摘要
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      展开全部 ({paper.abstract?.length} 字)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 引用列表 */}
        <div className="p-5">
          <CitationList paperId={paperId} />
        </div>
      </div>

      {/* 编辑弹窗 */}
      {showEditModal && (
        <PaperEditModal
          paper={paper}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            refetch()
          }}
        />
      )}
    </>
  )
}
