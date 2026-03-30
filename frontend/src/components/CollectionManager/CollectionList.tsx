import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCollections } from '../../hooks/useCollections'
import { CollectionCard } from './CollectionCard'
import { CreateCollectionModal } from './CreateCollectionModal'

interface CollectionListProps {
  onSelectCollection: (id: string) => void
  selectedId?: string | null
}

export function CollectionList({ onSelectCollection, selectedId }: CollectionListProps) {
  const { collections, isLoading, createCollection, deleteCollection } = useCollections()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">知识库</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          新建
        </button>
      </div>

      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          isSelected={selectedId === collection.id}
          onClick={() => onSelectCollection(collection.id)}
          onDelete={() => deleteCollection(collection.id)}
        />
      ))}

      {collections.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          还没有知识库，点击"新建"创建第一个
        </div>
      )}

      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createCollection}
      />
    </div>
  )
}