import { useState, useEffect } from 'react'
import { X, FileText, Loader2, ZoomIn, ZoomOut, Download } from 'lucide-react'

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
  const fileUrl = `/api/collections/${collectionId}/documents/${documentId}/file`

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

        const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}/content`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || '获取文档内容失败')
        }

        const data = await response.json()
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

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = documentTitle
    link.click()
  }

  const zoomIn = () => setScale(s => Math.min(s + 25, 200))
  const zoomOut = () => setScale(s => Math.max(s - 25, 50))

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 truncate max-w-md">
              {documentTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* PDF 控制按钮 */}
            {isPdf && (
              <>
                <button
                  onClick={zoomOut}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="缩小"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 w-12 text-center">{scale}%</span>
                <button
                  onClick={zoomIn}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="放大"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : isPdf ? (
            <div className="h-full overflow-auto p-4 flex justify-center">
              <embed
                src={fileUrl}
                type="application/pdf"
                className="border-0 shadow-lg rounded"
                style={{
                  width: `${scale}%`,
                  height: '100%',
                  minWidth: '600px'
                }}
              />
            </div>
          ) : (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 text-sm text-gray-500">
                  字符数: {charCount.toLocaleString()}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed bg-white p-6 rounded-lg shadow">
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
