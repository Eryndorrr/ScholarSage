import { useEffect, useCallback } from 'react'
import { Plus, Trash2, MessageSquare, MessageCircle, Search, X } from 'lucide-react'
import { ResizableSidebar } from '../../../components/Layout/ResizableSidebar'
import { useCollectionStore } from '../../../stores/collectionStore'
import { useSessionStore } from '../../../stores/sessionStore'
import { sessionService } from '../../../services/sessionService'

export function SessionSidebar() {
  const selectedCollectionId = useCollectionStore((s) => s.selectedId)
  const {
    sessions,
    currentSession,
    searchQuery,
    setSessions,
    addSession,
    removeSession,
    setCurrentSession,
    setMessages,
    setSearchQuery,
  } = useSessionStore()

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    if (!selectedCollectionId) return
    try {
      const data = await sessionService.list(selectedCollectionId)
      setSessions(data.sessions)
      if (!currentSession && data.sessions.length > 0) {
        selectSession(data.sessions[0])
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }, [selectedCollectionId, currentSession, setSessions])

  // Select session
  const selectSession = async (session: typeof currentSession) => {
    if (!session) return
    setCurrentSession(session)
    try {
      const fullSession = await sessionService.get(session.id)
      setMessages(fullSession.messages || [])
    } catch (error) {
      console.error('Failed to load session messages:', error)
      setMessages([])
    }
  }

  // Create new session
  const createNewSession = async () => {
    if (!selectedCollectionId) return
    try {
      const newSession = await sessionService.create(selectedCollectionId, '新对话')
      addSession(newSession)
      setCurrentSession(newSession)
      setMessages([])
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Delete session
  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此对话？')) return

    try {
      await sessionService.delete(sessionId)
      removeSession(sessionId)
      if (currentSession?.id === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId)
        if (remaining.length > 0) {
          selectSession(remaining[0])
        } else {
          setCurrentSession(null)
          setMessages([])
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  // Load sessions when collection changes
  useEffect(() => {
    if (!selectedCollectionId) {
      setSessions([])
      setCurrentSession(null)
      setMessages([])
      setSearchQuery('')
      return
    }
    fetchSessions()
  }, [selectedCollectionId, fetchSessions, setSessions, setCurrentSession, setMessages, setSearchQuery])

  const filteredSessions = sessions.filter(s =>
    s.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <ResizableSidebar
      defaultWidth={256}
      minWidth={200}
      maxWidth={400}
      side="right"
      title="对话"
    >
      <div className="p-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">对话</span>
          <button
            onClick={createNewSession}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新对话
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-7 pr-6 py-1 text-xs border dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs mb-2">暂无对话</p>
            <button
              onClick={createNewSession}
              className="text-blue-500 dark:text-blue-400 text-xs hover:underline"
            >
              开始新对话
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p className="text-xs">无匹配对话</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => selectSession(session)}
                className={`group p-2.5 rounded-lg cursor-pointer transition-all ${
                  currentSession?.id === session.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-600'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                      {session.title || '新对话'}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {session.message_count} 条消息
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ResizableSidebar>
  )
}
