import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCollections } from '../../hooks/useCollections'
import { CreateCollectionModal } from './CreateCollectionModal'

interface CollectionListProps {
  onSelectCollection: (id: string) => void
  selectedId?: string | null
}

export function CollectionList({ onSelectCollection, selectedId }: CollectionListProps) {
  const { collections, isLoading, createCollection, deleteCollection } = useCollections()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500 text-sm">加载中...</div>
  }

  return (
    <div className="space-y-1">
      {collections.map((collection) => (
        <div
          key={collection.id}
          onClick={() => onSelectCollection(collection.id)}
          className={`group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
            selectedId === collection.id
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-gray-100 border border-transparent'
          }`}
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: collection.color || '#3b82f6' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {collection.name}
            </p>
            <p className="text-xs text-gray-500">
              {collection.document_count || 0} 个文档
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('确定删除此知识库？')) {
                deleteCollection(collection.id)
              }
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {collections.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">
          暂无知识库
        </div>
      )}

      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 p-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-blue-300"
      >
        <Plus className="w-4 h-4" />
        新建知识库
      </button>

      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createCollection}
      />
    </div>
  )
}
