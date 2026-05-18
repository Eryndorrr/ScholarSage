import { useEffect } from 'react'
import { useCollectionStore } from '../../stores/collectionStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSessionStore } from '../../stores/sessionStore'
import { ResizableSidebar } from '../../components/Layout/ResizableSidebar'
import { Sidebar } from './components/Sidebar'

// Placeholder components - will be implemented in next tasks
const DocumentPanelPlaceholder = () => <div className="p-4">Document Panel (TODO)</div>
const ChatPanelPlaceholder = () => <div className="p-4">Chat Panel (TODO)</div>

export function MainPage() {
  const selectedId = useCollectionStore((s) => s.selectedId)
  const resetDocs = useDocumentStore((s) => s.reset)
  const resetSessions = useSessionStore((s) => s.reset)

  // Reset child state when collection changes
  useEffect(() => {
    if (!selectedId) {
      resetDocs()
      resetSessions()
    }
  }, [selectedId, resetDocs, resetSessions])

  return (
    <div className="flex-1 flex overflow-hidden">
      <ResizableSidebar
        defaultWidth={256}
        minWidth={200}
        maxWidth={400}
        side="left"
        title="知识库"
      >
        <Sidebar />
      </ResizableSidebar>

      <ResizableSidebar
        defaultWidth={400}
        minWidth={320}
        maxWidth={700}
        side="left"
        title="文档"
      >
        <DocumentPanelPlaceholder />
      </ResizableSidebar>

      <ChatPanelPlaceholder />
    </div>
  )
}
