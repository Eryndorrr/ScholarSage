import { useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import type { Paper } from '../../types/paper'
import { paperService } from '../../services/paperService'

interface PaperEditModalProps {
  paper: Paper
  onClose: () => void
  onSave: () => void
}

export function PaperEditModal({ paper, onClose, onSave }: PaperEditModalProps) {
  const [formData, setFormData] = useState({
    title: paper.title || '',
    authors: paper.authors.join(', '),
    abstract: paper.abstract || '',
    keywords: paper.keywords.join(', '),
    publication_year: paper.publication_year?.toString() || '',
    venue: paper.venue || '',
    doi: paper.doi || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const updateData = {
        title: formData.title.trim() || undefined,
        authors: formData.authors
          .split(',')
          .map(a => a.trim())
          .filter(a => a),
        abstract: formData.abstract.trim() || undefined,
        keywords: formData.keywords
          .split(',')
          .map(k => k.trim())
          .filter(k => k),
        publication_year: formData.publication_year
          ? parseInt(formData.publication_year)
          : undefined,
        venue: formData.venue.trim() || undefined,
        doi: formData.doi.trim() || undefined,
      }

      await paperService.updatePaper(paper.id, updateData)
      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">编辑论文信息</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="论文标题"
            />
          </div>

          {/* 作者 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              作者
            </label>
            <input
              type="text"
              value={formData.authors}
              onChange={(e) => handleChange('authors', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="多个作者用逗号分隔"
            />
            <p className="text-xs text-gray-500 mt-1">多个作者用逗号分隔</p>
          </div>

          {/* 摘要 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              摘要
            </label>
            <textarea
              value={formData.abstract}
              onChange={(e) => handleChange('abstract', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="论文摘要"
            />
          </div>

          {/* 关键词 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词
            </label>
            <input
              type="text"
              value={formData.keywords}
              onChange={(e) => handleChange('keywords', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="多个关键词用逗号分隔"
            />
            <p className="text-xs text-gray-500 mt-1">多个关键词用逗号分隔</p>
          </div>

          {/* 年份和 Venue */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发表年份
              </label>
              <input
                type="number"
                value={formData.publication_year}
                onChange={(e) => handleChange('publication_year', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="2024"
                min="1900"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发表于
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => handleChange('venue', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="期刊/会议名称"
              />
            </div>
          </div>

          {/* DOI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DOI
            </label>
            <input
              type="text"
              value={formData.doi}
              onChange={(e) => handleChange('doi', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="10.xxxx/xxxxx"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
