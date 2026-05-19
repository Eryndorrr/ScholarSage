import { useState } from 'react'
import { X, Edit3 } from 'lucide-react'
import type { Collection, CollectionUpdate } from '../../types/collection'

interface EditCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (id: string, data: CollectionUpdate) => void
  collection: Collection | null
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

export function EditCollectionModal({ isOpen, onClose, onSubmit, collection }: EditCollectionModalProps) {
  if (!isOpen || !collection) return null

  return (
    <EditCollectionForm
      key={collection.id}
      collection={collection}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function EditCollectionForm({
  onClose,
  onSubmit,
  collection,
}: {
  onClose: () => void
  onSubmit: (id: string, data: CollectionUpdate) => void
  collection: Collection
}) {
  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description || '')
  const [color, setColor] = useState(collection.color || PRESET_COLORS[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    // 只提交有变化的字段
    const updates: CollectionUpdate = {}
    if (name.trim() !== collection.name) {
      updates.name = name.trim()
    }
    if (description.trim() !== (collection.description || '')) {
      updates.description = description.trim()
    }
    if (color !== collection.color) {
      updates.color = color
    }

    // 如果有变化才提交
    if (Object.keys(updates).length > 0) {
      onSubmit(collection.id, updates)
    }
    onClose()
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-800">编辑知识库</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入知识库名称"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选，描述知识库内容"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              颜色
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 text-sm font-medium transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
