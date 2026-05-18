import { useEffect } from 'react'
import { useCollectionStore } from '../../stores/collectionStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSessionStore } from '../../stores/sessionStore'
import { ResizableSidebar } from '../../components/Layout/ResizableSidebar'
import { Sidebar } from './components/Sidebar'
import { DocumentPanel } from './components/DocumentPanel'
import { ChatPanel } from './components/ChatPanel'

// Placeholder components - will be implemented in next tasks

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
    <div className="h-full min-h-0 flex-1 flex overflow-hidden">
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
        <DocumentPanel />
      </ResizableSidebar>

      <ChatPanel />
    </div>
  )
}
