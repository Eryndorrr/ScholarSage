import { MessageSquare } from 'lucide-react'
import { useCollectionStore } from '../../../stores/collectionStore'
import { useSessionStore } from '../../../stores/sessionStore'
import { ChatWindow } from '../../../components/QAInterface/ChatWindow'
import { SessionSidebar } from './SessionSidebar'
import { sessionService } from '../../../services/sessionService'

export function ChatPanel() {
  const selectedCollectionId = useCollectionStore((s) => s.selectedId)
  const {
    currentSession,
    messages,
    setMessages,
    updateCurrentSession,
  } = useSessionStore()

  // Handle query complete - refresh session
  const handleQueryComplete = async () => {
    if (!currentSession) return
    try {
      const fullSession = await sessionService.get(currentSession.id)
      setMessages(fullSession.messages || [])
      updateCurrentSession({
        title: fullSession.title,
        message_count: fullSession.message_count,
      })
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }

  // Handle title update
  const handleUpdateTitle = async (title: string) => {
    if (!currentSession) return
    try {
      await sessionService.update(currentSession.id, { title })
      updateCurrentSession({ title })
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }

  // Handle web search toggle
  const handleToggleWebSearch = async (enabled: boolean) => {
    if (!currentSession) return
    try {
      await sessionService.update(currentSession.id, { web_search_enabled: enabled })
      updateCurrentSession({ web_search_enabled: enabled })
    } catch (error) {
      console.error('Failed to toggle web search:', error)
    }
  }

  return (
    <main className="flex-1 flex overflow-hidden min-h-0">
      {/* Chat window */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-gray-800">
        {selectedCollectionId ? (
          <ChatWindow
            collectionId={selectedCollectionId}
            sessionId={currentSession?.id || null}
            sessionMessages={messages}
            sessionTitle={currentSession?.title || null}
            webSearchEnabled={currentSession?.web_search_enabled || false}
            onQueryComplete={handleQueryComplete}
            onUpdateTitle={handleUpdateTitle}
            onToggleWebSearch={handleToggleWebSearch}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">开始对话</p>
              <p className="text-sm mt-1">选择左侧知识库后即可提问</p>
            </div>
          </div>
        )}
      </div>

      {/* Session sidebar */}
      {selectedCollectionId && <SessionSidebar />}
    </main>
  )
}
