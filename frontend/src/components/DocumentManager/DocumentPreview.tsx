import { useState, useEffect } from 'react'
import { X, FileText, Loader2, ZoomIn, ZoomOut, Download } from 'lucide-react'
import { documentService } from '../../services/documentService'

interface DocumentPreviewProps {
  collectionId: string
  documentId: string
  documentTitle: string
  fileType: string
  onClose: () => void
}

export function DocumentPreview({ collectionId, documentId, documentTitle, fileType, onClose }: DocumentPreviewProps) {
  const [textContent, setTextContent] = useState<string>('')
  const [charCount, setCharCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(100)

  const isPdf = fileType === 'pdf'

  useEffect(() => {
    // PDF 不需要加载文本内容
    if (isPdf) {
      setLoading(false)
      return
    }

    const fetchContent = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await documentService.getContent(collectionId, documentId)
        setTextContent(data.content)
        setCharCount(data.char_count)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取文档内容失败')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [collectionId, documentId, isPdf])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('rag_access_token')
      const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!response.ok) throw new Error('下载失败')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = documentTitle
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const zoomIn = () => setScale(s => Math.min(s + 25, 200))
  const zoomOut = () => setScale(s => Math.max(s - 25, 50))

  // 构建带认证的 PDF URL（使用 blob 方式）
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isPdf) return
    let objectUrl: string | null = null

    const loadPdf = async () => {
      try {
        const token = localStorage.getItem('rag_access_token')
        const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (!response.ok) throw new Error('加载PDF失败')

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载PDF失败')
      }
    }
    loadPdf()

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [collectionId, documentId, isPdf])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate max-w-md">
              {documentTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* PDF 控制按钮 */}
            {isPdf && (
              <>
                <button
                  onClick={zoomOut}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="缩小"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300 w-12 text-center">{scale}%</span>
                <button
                  onClick={zoomIn}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="放大"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">加载中...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : isPdf ? (
            <div className="h-full overflow-auto p-4 flex justify-center">
              {pdfUrl ? (
                <embed
                  src={pdfUrl}
                  type="application/pdf"
                  className="border-0 shadow-lg rounded"
                  style={{
                    width: `${scale}%`,
                    height: '100%',
                    minWidth: '600px'
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-500 dark:text-gray-400">加载PDF...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  字符数: {charCount.toLocaleString()}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  {textContent}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
