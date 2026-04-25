import { useState } from 'react'
import { Plus, Trash2, Pencil, Search, X } from 'lucide-react'
import { useCollections } from '../../hooks/useCollections'
import { CreateCollectionModal } from './CreateCollectionModal'
import { EditCollectionModal } from './EditCollectionModal'
import type { Collection } from '../../types/collection'

interface CollectionListProps {
  onSelectCollection: (id: string) => void
  selectedId?: string | null
}

export function CollectionList({ onSelectCollection, selectedId }: CollectionListProps) {
  const { collections, isLoading, createCollection, updateCollection, deleteCollection } = useCollections()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 前端过滤
  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">加载中...</div>
  }

  return (
    <div className="space-y-1">
      {/* 搜索框 */}
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索知识库..."
          className="w-full pl-8 pr-7 py-1.5 text-xs border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {filteredCollections.map((collection) => (
        <div
          key={collection.id}
          onClick={() => onSelectCollection(collection.id)}
          className={`group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
            selectedId === collection.id
              ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
          }`}
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: collection.color || '#3b82f6' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {collection.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {collection.document_count || 0} 个文档
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEditingCollection(collection)
              }}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('确定删除此知识库？')) {
                  deleteCollection(collection.id)
                }
              }}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {filteredCollections.length === 0 && (
        <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
          {searchQuery ? '无匹配结果' : '暂无知识库'}
        </div>
      )}

      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 p-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"
      >
        <Plus className="w-4 h-4" />
        新建知识库
      </button>

      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createCollection}
      />

      <EditCollectionModal
        isOpen={editingCollection !== null}
        onClose={() => setEditingCollection(null)}
        onSubmit={updateCollection}
        collection={editingCollection}
      />
    </div>
  )
}
