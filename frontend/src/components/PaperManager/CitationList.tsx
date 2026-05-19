import { useState } from 'react'
import { useCitations } from '../../hooks/usePapers'
import { paperService } from '../../services/paperService'
import { BookOpen, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Citation } from '../../types/citation'

interface CitationListProps {
  paperId: string
}

export function CitationList({ paperId }: CitationListProps) {
  const { data, isLoading, error, refetch } = useCitations(paperId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Citation>>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = (citation: Citation) => {
    setEditingId(citation.id)
    setEditForm({
      cited_title: citation.cited_title || '',
      cited_authors: citation.cited_authors || [],
      cited_year: citation.cited_year,
      cited_venue: citation.cited_venue || '',
      location: citation.location || '',
    })
  }

  const handleAdd = () => {
    setIsAdding(true)
    setEditForm({
      cited_title: '',
      cited_authors: [],
      cited_year: null,
      cited_venue: '',
      location: '',
    })
  }

  const handleSave = async () => {
    if (!editForm.cited_title?.trim()) {
      toast.error('请输入标题')
      return
    }

    setIsSaving(true)
    try {
      if (isAdding) {
        await paperService.addCitation(paperId, editForm)
        toast.success('添加成功')
        setIsAdding(false)
      } else if (editingId) {
        await paperService.updateCitation(editingId, editForm)
        toast.success('更新成功')
        setEditingId(null)
      }
      setEditForm({})
      refetch()
    } catch {
      toast.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (citationId: string) => {
    if (!confirm('确定删除这条参考文献？')) return

    try {
      await paperService.deleteCitation(citationId)
      toast.success('删除成功')
      refetch()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setIsAdding(false)
    setEditForm({})
  }

  const parseAuthors = (value: string): string[] => {
    return value.split(/[;,]/).map(a => a.trim()).filter(a => a)
  }

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

  const citations = data?.citations || []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          参考文献 ({data?.total || 0})
        </h4>
        {!isAdding && !editingId && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        )}
      </div>

      {/* 添加新引用表单 */}
      {isAdding && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">新增参考文献</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? '保存中...' : <><Check className="w-3.5 h-3.5" /> 保存</>}
              </button>
              <button
                onClick={handleCancel}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <CitationForm form={editForm} setForm={setEditForm} parseAuthors={parseAuthors} />
        </div>
      )}

      {/* 引用列表 */}
      {citations.length === 0 && !isAdding ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-500" />
          <p className="text-sm">暂无引用信息</p>
          <p className="text-xs mt-1">点击上方"添加"按钮手动添加</p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {citations.map((citation) => (
            <li
              key={citation.id}
              className={`p-3 rounded-lg text-sm transition-colors ${
                editingId === citation.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {editingId === citation.id ? (
                // 编辑模式
                <div className="space-y-3">
                  <div className="flex items-center justify-end gap-1 mb-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? '保存中...' : <><Check className="w-3.5 h-3.5" /> 保存</>}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <CitationForm form={editForm} setForm={setEditForm} parseAuthors={parseAuthors} />
                </div>
              ) : (
                // 显示模式
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {citation.cited_title || '未知标题'}
                    </p>
                    {citation.cited_authors && citation.cited_authors.length > 0 && (
                      <p className="text-gray-600 dark:text-gray-300 mt-1">
                        {citation.cited_authors.join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {citation.cited_year && <span>{citation.cited_year}</span>}
                      {citation.cited_venue && <span>· {citation.cited_venue}</span>}
                      {citation.location && <span>· {citation.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(citation)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded"
                      title="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(citation.id)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 表单组件
function CitationForm({
  form,
  setForm,
  parseAuthors
}: {
  form: Partial<Citation>
  setForm: React.Dispatch<React.SetStateAction<Partial<Citation>>>
  parseAuthors: (value: string) => string[]
}) {
  return (
    <>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">标题 *</label>
        <input
          type="text"
          value={form.cited_title || ''}
          onChange={(e) => setForm(prev => ({ ...prev, cited_title: e.target.value }))}
          className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
          placeholder="论文标题"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">作者（用逗号或分号分隔）</label>
        <input
          type="text"
          value={form.cited_authors?.join(', ') || ''}
          onChange={(e) => setForm(prev => ({ ...prev, cited_authors: parseAuthors(e.target.value) }))}
          className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
          placeholder="作者1, 作者2"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">年份</label>
          <input
            type="number"
            value={form.cited_year || ''}
            onChange={(e) => setForm(prev => ({ ...prev, cited_year: e.target.value ? parseInt(e.target.value) : null }))}
            className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
            placeholder="2024"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">期刊/会议</label>
          <input
            type="text"
            value={form.cited_venue || ''}
            onChange={(e) => setForm(prev => ({ ...prev, cited_venue: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
            placeholder="期刊名"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">引用位置</label>
        <input
          type="text"
          value={form.location || ''}
          onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
          className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
          placeholder="如：第3页"
        />
      </div>
    </>
  )
}
