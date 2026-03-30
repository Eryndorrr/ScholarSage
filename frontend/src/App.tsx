import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/Layout/MainLayout'
import { CollectionList } from './components/CollectionManager/CollectionList'
import { ChatWindow } from './components/QAInterface/ChatWindow'
import { DocumentUpload } from './components/DocumentManager/DocumentUpload'
import { DocumentList } from './components/DocumentManager/DocumentList'
import { useState, useEffect, useRef } from 'react'
import type { Document } from './types/document'

const queryClient = new QueryClient()

function App() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
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

    // 检查是否有处理中的文档
    const hasProcessingDocs = documents.some(
      doc => doc.status === 'pending' || doc.status === 'processing'
    )

    if (hasProcessingDocs && !pollingRef.current) {
      // 开始轮询
      pollingRef.current = window.setInterval(() => {
        fetchDocuments()
      }, 2000) // 每2秒刷新一次
    } else if (!hasProcessingDocs && pollingRef.current) {
      // 停止轮询
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
    // 刷新文档列表
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

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <div className="flex gap-6">
          {/* 左侧：知识库列表 */}
          <div className="w-80 flex-shrink-0">
            <CollectionList
              onSelectCollection={setSelectedCollection}
              selectedId={selectedCollection}
            />
          </div>

          {/* 中间：文档管理 */}
          <div className="w-80 flex-shrink-0">
            {selectedCollection ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">文档管理</h3>
                <DocumentUpload
                  collectionId={selectedCollection}
                  onUploadComplete={handleUploadComplete}
                />
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    已上传文档 ({documents.length})
                  </h4>
                  {isLoadingDocs ? (
                    <div className="text-center py-4 text-gray-500">加载中...</div>
                  ) : (
                    <DocumentList
                      documents={documents}
                      onDelete={handleDeleteDocument}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                请先选择一个知识库
              </div>
            )}
          </div>

          {/* 右侧：问答界面 */}
          <div className="flex-1">
            <ChatWindow collectionId={selectedCollection} />
          </div>
        </div>
      </MainLayout>
    </QueryClientProvider>
  )
}

export default App
