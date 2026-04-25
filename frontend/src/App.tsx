import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/Layout/MainLayout'
import { Header } from './components/Layout/Header'
import { ResizableSidebar } from './components/Layout/ResizableSidebar'
import { CollectionList } from './components/CollectionManager/CollectionList'
import { ChatWindow } from './components/QAInterface/ChatWindow'
import { DocumentUpload } from './components/DocumentManager/DocumentUpload'
import { DocumentList } from './components/DocumentManager/DocumentList'
import { DocumentPreview } from './components/DocumentManager/DocumentPreview'
import { PaperList } from './components/PaperManager/PaperList'
import { PaperDetail } from './components/PaperManager/PaperDetail'
import { EvaluationPage } from './components/Evaluation/EvaluationPage'
import { KnowledgeGraphPage } from './components/KnowledgeGraph/KnowledgeGraphPage'
import { HealthDashboard } from './components/Dashboard/HealthDashboard'
import { AuthPage } from './components/Auth/AuthPage'
import { SettingsModal } from './components/Auth/SettingsModal'
import { AdminPage } from './components/Admin/AdminPage'
import { Pagination } from './components/common/Pagination'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { useState, useEffect, useRef } from 'react'
import type { Document } from './types/document'
import type { Session, SessionMessage } from './types/session'
import { sessionService } from './services/sessionService'
import { apiClient } from './services/api'
import { FileText, FolderOpen, MessageSquare, Plus, Trash2, MessageCircle, BookOpen, FileStack, Search, X } from 'lucide-react'

const queryClient = new QueryClient()

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()

  // 加载中显示 loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  // 未认证显示登录页
  if (!isAuthenticated) {
    return <AuthPage />
  }

  // 已认证显示主界面
  return <MainApp />
}

function MainApp() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)

  // 文档分页状态
  const [docCurrentPage, setDocCurrentPage] = useState(1)
  const [docTotal, setDocTotal] = useState(0)
  const docPageSize = 20

  // 中间面板标签页
  const [middlePanelTab, setMiddlePanelTab] = useState<'documents' | 'papers'>('documents')
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null)
  const [showEvaluationPage, setShowEvaluationPage] = useState(false)
  const [showGraphPage, setShowGraphPage] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showAdminPage, setShowAdminPage] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sessionSearchQuery, setSessionSearchQuery] = useState('')

  // Session 状态
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([])

  const pollingRef = useRef<number | null>(null)

  // 加载文档列表 (使用 apiClient，支持分页)
  const fetchDocuments = async (page: number = 1) => {
    if (!selectedCollection) return
    try {
      const skip = (page - 1) * docPageSize
      const response = await apiClient.get(`/api/collections/${selectedCollection}/documents`, {
        params: { skip, limit: docPageSize }
      })
      setDocuments(response.data.documents)
      setDocTotal(response.data.total)
      setDocCurrentPage(page)
      return response.data.documents
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
    return null
  }

  // 加载会话列表
  const fetchSessions = async () => {
    if (!selectedCollection) return
    try {
      const data = await sessionService.list(selectedCollection)
      setSessions(data.sessions)

      // 如果没有当前会话，自动选择最新的
      if (!currentSession && data.sessions.length > 0) {
        selectSession(data.sessions[0])
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  // 选择会话
  const selectSession = async (session: Session) => {
    setCurrentSession(session)
    try {
      const fullSession = await sessionService.get(session.id)
      setSessionMessages(fullSession.messages || [])
    } catch (error) {
      console.error('Failed to load session messages:', error)
      setSessionMessages([])
    }
  }

  // 创建新会话
  const createNewSession = async () => {
    if (!selectedCollection) return
    try {
      const newSession = await sessionService.create(selectedCollection, '新对话')
      setSessions(prev => [newSession, ...prev])
      setCurrentSession(newSession)
      setSessionMessages([])
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // 删除会话
  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此对话？')) return

    try {
      await sessionService.delete(sessionId)
      const newSessions = sessions.filter(s => s.id !== sessionId)
      setSessions(newSessions)

      if (currentSession?.id === sessionId) {
        if (newSessions.length > 0) {
          selectSession(newSessions[0])
        } else {
          setCurrentSession(null)
          setSessionMessages([])
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  // 更新会话标题
  const updateSessionTitle = async (title: string) => {
    if (!currentSession) return
    try {
      await sessionService.update(currentSession.id, { title })
      setSessions(prev => prev.map(s =>
        s.id === currentSession.id ? { ...s, title } : s
      ))
      setCurrentSession(prev => prev ? { ...prev, title } : null)
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }

  // 切换联网检索
  const toggleWebSearch = async (enabled: boolean) => {
    if (!currentSession) return
    try {
      await sessionService.update(currentSession.id, { web_search_enabled: enabled })
      setSessions(prev => prev.map(s =>
        s.id === currentSession.id ? { ...s, web_search_enabled: enabled } : s
      ))
      setCurrentSession(prev => prev ? { ...prev, web_search_enabled: enabled } : null)
    } catch (error) {
      console.error('Failed to toggle web search:', error)
    }
  }

  // 初始加载
  useEffect(() => {
    if (!selectedCollection) {
      setDocuments([])
      setSessions([])
      setCurrentSession(null)
      setSessionMessages([])
      setSessionSearchQuery('') // 清空对话搜索
      setDocCurrentPage(1)
      setDocTotal(0)
      return
    }

    // 切换知识库时清空搜索
    setSessionSearchQuery('')
    setDocCurrentPage(1)
    setIsLoadingDocs(true)
    fetchDocuments(1).finally(() => setIsLoadingDocs(false))
    fetchSessions()
  }, [selectedCollection])

  // 轮询
  useEffect(() => {
    if (!selectedCollection) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    const hasProcessingDocs = documents.some(
      doc => doc.status === 'pending' || doc.status === 'processing'
    )

    if (hasProcessingDocs && !pollingRef.current) {
      pollingRef.current = window.setInterval(() => {
        fetchDocuments()
      }, 2000)
    } else if (!hasProcessingDocs && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [selectedCollection, documents])

  const handleUploadComplete = async () => {
    // 上传后刷新到第一页
    const data = await fetchDocuments(1)
    if (data) {
      setDocuments(data)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedCollection) return
    if (!confirm('确定要删除这个文档吗？')) return

    try {
      const response = await apiClient.delete(
        `/api/collections/${selectedCollection}/documents/${documentId}`
      )
      if (response.status === 200) {
        setDocuments(documents.filter(d => d.id !== documentId))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const handleQueryComplete = async () => {
    // 刷新会话消息
    if (currentSession) {
      try {
        const fullSession = await sessionService.get(currentSession.id)
        setSessionMessages(fullSession.messages || [])
        setSessions(prev => prev.map(s =>
          s.id === fullSession.id ? { ...s, title: fullSession.title, message_count: fullSession.message_count } : s
        ))
      } catch (error) {
        console.error('Failed to refresh session:', error)
      }
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      {showAdminPage ? (
        <AdminPage onBack={() => setShowAdminPage(false)} />
      ) : showDashboard ? (
        <HealthDashboard onBack={() => setShowDashboard(false)} />
      ) : showGraphPage ? (
        <KnowledgeGraphPage onBack={() => setShowGraphPage(false)} />
      ) : showEvaluationPage ? (
        <EvaluationPage onBack={() => setShowEvaluationPage(false)} />
      ) : (
        <MainLayout>
          <Header
            onEvaluationClick={() => setShowEvaluationPage(true)}
            onGraphClick={() => setShowGraphPage(true)}
            onDashboardClick={() => setShowDashboard(true)}
            onAdminClick={() => setShowAdminPage(true)}
            onSettingsClick={() => setShowSettings(true)}
          />

          <div className="flex-1 flex overflow-hidden">
            {/* 左侧边栏：知识库 */}
            <ResizableSidebar
              defaultWidth={256}
              minWidth={200}
              maxWidth={400}
              side="left"
              title="知识库"
            >
              <div className="p-4 border-b dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm font-medium">知识库</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <CollectionList
                  onSelectCollection={setSelectedCollection}
                  selectedId={selectedCollection}
                />
              </div>
            </ResizableSidebar>

            {/* 中间面板：文档/论文管理 */}
            <ResizableSidebar
              defaultWidth={400}
              minWidth={320}
              maxWidth={700}
              side="left"
              title="文档"
            >
              {selectedCollection ? (
                <>
                  {/* 标签页切换 */}
                  <div className="border-b dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex">
                      <button
                        onClick={() => setMiddlePanelTab('documents')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                          middlePanelTab === 'documents'
                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <FileStack className="w-4 h-4" />
                        文档
                      </button>
                      <button
                        onClick={() => setMiddlePanelTab('papers')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                          middlePanelTab === 'papers'
                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        论文
                      </button>
                    </div>
                  </div>

                  {/* 内容区域 */}
                  {middlePanelTab === 'documents' ? (
                    <>
                      <div className="p-4">
                        <DocumentUpload
                          collectionId={selectedCollection}
                          onUploadComplete={handleUploadComplete}
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto px-4 pb-4">
                        {isLoadingDocs ? (
                          <div className="text-center py-4 text-gray-500 dark:text-gray-400">加载中...</div>
                        ) : (
                          <>
                            <DocumentList
                              documents={documents}
                              collectionId={selectedCollection}
                              onDelete={handleDeleteDocument}
                              onPreview={setPreviewDocument}
                              onRefresh={() => fetchDocuments(docCurrentPage)}
                            />
                            <Pagination
                              currentPage={docCurrentPage}
                              totalPages={Math.ceil(docTotal / docPageSize)}
                              total={docTotal}
                              onPageChange={(page) => {
                                setIsLoadingDocs(true)
                                fetchDocuments(page).finally(() => setIsLoadingDocs(false))
                              }}
                            />
                          </>
                        )}
                      </div>
                    </>
                  ) : selectedPaper ? (
                    <div className="flex-1 overflow-y-auto p-4">
                      <PaperDetail
                        paperId={selectedPaper}
                        onClose={() => setSelectedPaper(null)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-4">
                      <PaperList
                        collectionId={selectedCollection}
                        onSelectPaper={setSelectedPaper}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">选择知识库查看内容</p>
                  </div>
                </div>
              )}
            </ResizableSidebar>

            {/* 右侧：对话窗口 + 对话列表 */}
            <main className="flex-1 flex">
              {/* 对话窗口 */}
              <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
                {selectedCollection ? (
                  <ChatWindow
                    collectionId={selectedCollection}
                    sessionId={currentSession?.id || null}
                    sessionMessages={sessionMessages}
                    sessionTitle={currentSession?.title || null}
                    webSearchEnabled={currentSession?.web_search_enabled || false}
                    onQueryComplete={handleQueryComplete}
                    onUpdateTitle={updateSessionTitle}
                    onToggleWebSearch={toggleWebSearch}
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

              {/* 对话列表 */}
              {selectedCollection && (
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
                    {/* 搜索框 */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <input
                        type="text"
                        value={sessionSearchQuery}
                        onChange={(e) => setSessionSearchQuery(e.target.value)}
                        placeholder="搜索对话..."
                        className="w-full pl-7 pr-6 py-1 text-xs border dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      />
                      {sessionSearchQuery && (
                        <button
                          onClick={() => setSessionSearchQuery('')}
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
                    ) : sessions.filter(s => s.title?.toLowerCase().includes(sessionSearchQuery.toLowerCase())).length === 0 ? (
                      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                        <p className="text-xs">无匹配对话</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {sessions.filter(s => s.title?.toLowerCase().includes(sessionSearchQuery.toLowerCase())).map((session) => (
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
              )}
            </main>
          </div>

          {/* 文档预览弹窗 */}
          {previewDocument && selectedCollection && (
            <DocumentPreview
              collectionId={selectedCollection}
              documentId={previewDocument.id}
              documentTitle={previewDocument.title}
              fileType={previewDocument.file_type}
              onClose={() => setPreviewDocument(null)}
            />
          )}

          {/* 设置弹窗 */}
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} />
          )}
        </MainLayout>
      )}
    </QueryClientProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App