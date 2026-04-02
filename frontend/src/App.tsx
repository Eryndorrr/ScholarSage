import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/Layout/MainLayout'
import { Header } from './components/Layout/Header'
import { CollectionList } from './components/CollectionManager/CollectionList'
import { ChatWindow } from './components/QAInterface/ChatWindow'
import { DocumentUpload } from './components/DocumentManager/DocumentUpload'
import { DocumentList } from './components/DocumentManager/DocumentList'
import { DocumentPreview } from './components/DocumentManager/DocumentPreview'
import { QueryHistory } from './components/QueryHistory/QueryHistory'
import { useState, useEffect, useRef } from 'react'
import type { Document } from './types/document'
import { FileText, History, Upload, FolderOpen, MessageSquare } from 'lucide-react'

const queryClient = new QueryClient()

function App() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [activeTab, setActiveTab] = useState<'documents' | 'history'>('documents')
  const pollingRef = useRef<number | null>(null)

  // 加载文档列表
  const fetchDocuments = async () => {
    if (!selectedCollection) return
    try {
      const response = await fetch(`/api/collections/${selectedCollection}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data)
        return data
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
    return null
  }

  // 初始加载和切换知识库时
  useEffect(() => {
    if (!selectedCollection) {
      setDocuments([])
      return
    }

    setIsLoadingDocs(true)
    fetchDocuments().finally(() => setIsLoadingDocs(false))
  }, [selectedCollection])

  // 轮询：检查是否有处理中的文档
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
    const data = await fetchDocuments()
    if (data) {
      setDocuments(data)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedCollection) return
    if (!confirm('确定要删除这个文档吗？')) return

    try {
      const response = await fetch(
        `/api/collections/${selectedCollection}/documents/${documentId}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        setDocuments(documents.filter(d => d.id !== documentId))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const handleQueryComplete = () => {
    setHistoryKey(k => k + 1)
  }

  const handleRequery = (question: string) => {
    window.dispatchEvent(new CustomEvent('requery', { detail: question }))
    setActiveTab('documents') // 切换回文档标签以便看到对话
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <Header />

        <div className="flex-1 flex overflow-hidden">
          {/* 左侧边栏：知识库 */}
          <aside className="w-64 bg-white border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2 text-gray-600">
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
          </aside>

          {/* 中间面板：文档管理/历史 */}
          <aside className="w-80 bg-gray-50 border-r flex flex-col">
            {selectedCollection ? (
              <>
                {/* Tab 切换 */}
                <div className="flex border-b bg-white">
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                      activeTab === 'documents'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    文档
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                      activeTab === 'history'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    历史
                  </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto">
                  {activeTab === 'documents' ? (
                    <div className="p-4 space-y-4">
                      {/* 上传区域 */}
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-gray-700">
                          <Upload className="w-4 h-4" />
                          <span className="text-sm font-medium">上传文档</span>
                        </div>
                        <DocumentUpload
                          collectionId={selectedCollection}
                          onUploadComplete={handleUploadComplete}
                        />
                      </div>

                      {/* 文档列表 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">
                            已上传 {documents.length} 个文档
                          </span>
                        </div>
                        {isLoadingDocs ? (
                          <div className="text-center py-4 text-gray-500">加载中...</div>
                        ) : (
                          <DocumentList
                            documents={documents}
                            collectionId={selectedCollection}
                            onDelete={handleDeleteDocument}
                            onPreview={setPreviewDocument}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <QueryHistory
                        key={historyKey}
                        collectionId={selectedCollection}
                        onRequery={handleRequery}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">选择一个知识库开始</p>
                </div>
              </div>
            )}
          </aside>

          {/* 右侧：问答界面 */}
          <main className="flex-1 flex flex-col bg-white">
            {selectedCollection ? (
              <ChatWindow
                collectionId={selectedCollection}
                onQueryComplete={handleQueryComplete}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium text-gray-500">开始对话</p>
                  <p className="text-sm mt-1">选择左侧知识库后即可提问</p>
                </div>
              </div>
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
      </MainLayout>
    </QueryClientProvider>
  )
}

export default App
