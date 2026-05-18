import { FolderOpen } from 'lucide-react'
import { useCollectionStore } from '../../../stores/collectionStore'
import { CollectionList } from '../../../components/CollectionManager/CollectionList'

export function Sidebar() {
  const setSelectedId = useCollectionStore((s) => s.setSelectedId)
  const selectedId = useCollectionStore((s) => s.selectedId)

  return (
    <>
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm font-medium">知识库</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <CollectionList
          onSelectCollection={setSelectedId}
          selectedId={selectedId}
        />
      </div>
    </>
  )
}
