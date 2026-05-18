import { useEffect, useCallback } from 'react'
import { FileText, FileStack, BookOpen } from 'lucide-react'
import { useCollectionStore } from '../../../stores/collectionStore'
import { useDocumentStore } from '../../../stores/documentStore'
import { useUIStore } from '../../../stores/uiStore'
import { DocumentUpload } from '../../../components/DocumentManager/DocumentUpload'
import { DocumentList } from '../../../components/DocumentManager/DocumentList'
import { DocumentPreview } from '../../../components/DocumentManager/DocumentPreview'
import { PaperList } from '../../../components/PaperManager/PaperList'
import { PaperDetail } from '../../../components/PaperManager/PaperDetail'
import { Pagination } from '../../../components/common/Pagination'
import { apiClient } from '../../../services/api'
import type { Document, ProcessStatus } from '../../../types/document'

const PAGE_SIZE = 20

export function DocumentPanel() {
  const selectedCollectionId = useCollectionStore((s) => s.selectedId)
  const middlePanelTab = useUIStore((s) => s.middlePanelTab)
  const selectedPaperId = useUIStore((s) => s.selectedPaperId)
  const previewDocument = useUIStore((s) => s.previewDocument)

  const {
    documents,
    total,
    currentPage,
    isLoading,
    watchingDocIds,
    setDocuments,
    setTotal,
    setCurrentPage,
    setIsLoading,
    addWatchingDocIds,
    removeWatchingDocId,
    updateDocumentStatus,
  } = useDocumentStore()

  const setMiddlePanelTab = useUIStore((s) => s.setMiddlePanelTab)
  const setSelectedPaperId = useUIStore((s) => s.setSelectedPaperId)
  const setPreviewDocument = useUIStore((s) => s.setPreviewDocument)

  // Fetch documents
  const fetchDocuments = useCallback(async (page: number = 1) => {
    if (!selectedCollectionId) return null
    try {
      const skip = (page - 1) * PAGE_SIZE
      const response = await apiClient.get(
        `/api/collections/${selectedCollectionId}/documents`,
        { params: { skip, limit: PAGE_SIZE } }
      )
      setDocuments(response.data.documents)
      setTotal(response.data.total)
      setCurrentPage(page)
      addWatchingDocIds(
        response.data.documents
          .filter((doc: Document) => doc.status === 'pending' || doc.status === 'processing')
          .map((doc: Document) => doc.id)
      )
      return response.data.documents
    } catch (error) {
      console.error('Failed to fetch documents:', error)
      return null
    }
  }, [selectedCollectionId, setDocuments, setTotal, setCurrentPage, addWatchingDocIds])

  // Load documents when collection changes
  useEffect(() => {
    if (!selectedCollectionId) {
      setDocuments([])
      setTotal(0)
      setCurrentPage(1)
      return
    }

    setIsLoading(true)
    fetchDocuments(1).finally(() => setIsLoading(false))
  }, [selectedCollectionId, fetchDocuments, setDocuments, setTotal, setCurrentPage, setIsLoading])

  // Handle upload complete
  const handleUploadComplete = async (newDocIds?: string[]) => {
    const data = await fetchDocuments(1)
    if (data && newDocIds && newDocIds.length > 0) {
      addWatchingDocIds(newDocIds)
    }
  }

  // Handle status update from SSE
  const handleStatusUpdate = (docId: string, status: {
    status: ProcessStatus
    progress?: number
    chunk_count?: number
    error?: string
  }) => {
    updateDocumentStatus(docId, status)
    if (status.status === 'completed' || status.status === 'failed') {
      fetchDocuments(1)
      removeWatchingDocId(docId)
    }
  }

  // Handle delete
  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedCollectionId) return
    if (!confirm('确定要删除这个文档吗？')) return

    try {
      const response = await apiClient.delete(
        `/api/collections/${selectedCollectionId}/documents/${documentId}`
      )
      if (response.status === 200) {
        setDocuments(documents.filter(d => d.id !== documentId))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  if (!selectedCollectionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">选择知识库查看内容</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Tab switcher */}
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

      {/* Content area */}
      {middlePanelTab === 'documents' ? (
        <>
          <div className="p-4">
            <DocumentUpload
              collectionId={selectedCollectionId}
              onUploadComplete={handleUploadComplete}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {isLoading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">加载中...</div>
            ) : (
              <>
                <DocumentList
                  documents={documents}
                  collectionId={selectedCollectionId}
                  onDelete={handleDeleteDocument}
                  onPreview={(doc) => setPreviewDocument({ id: doc.id, title: doc.title, file_type: doc.file_type })}
                  onRefresh={() => fetchDocuments(currentPage)}
                  onStatusUpdate={handleStatusUpdate}
                  watchingDocIds={watchingDocIds}
                />
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(total / PAGE_SIZE)}
                  total={total}
                  onPageChange={(page) => {
                    setIsLoading(true)
                    fetchDocuments(page).finally(() => setIsLoading(false))
                  }}
                />
              </>
            )}
          </div>
        </>
      ) : selectedPaperId ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <PaperDetail
            paperId={selectedPaperId}
            onClose={() => setSelectedPaperId(null)}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <PaperList
            collectionId={selectedCollectionId}
            onSelectPaper={setSelectedPaperId}
          />
        </div>
      )}

      {/* Document preview modal */}
      {previewDocument && selectedCollectionId && (
        <DocumentPreview
          collectionId={selectedCollectionId}
          documentId={previewDocument.id}
          documentTitle={previewDocument.title}
          fileType={previewDocument.file_type}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </>
  )
}
