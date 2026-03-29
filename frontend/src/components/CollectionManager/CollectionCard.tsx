import { Folder, Trash2 } from 'lucide-react'
import { Collection } from '../../types/collection'

interface CollectionCardProps {
  collection: Collection
  onClick: () => void
  onDelete: () => void
}

export function CollectionCard({ collection, onClick, onDelete }: CollectionCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeftColor: collection.color }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4" style={{ color: collection.color }} />
            <h3 className="font-semibold text-sm">{collection.name}</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">{collection.description}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{collection.document_count} 篇文档</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}