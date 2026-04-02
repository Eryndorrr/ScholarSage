import { FileText, Trash2, Loader2, CheckCircle, XCircle, Clock, Eye } from 'lucide-react'
import type { Document } from '../../types/document'

interface DocumentListProps {
  documents: Document[]
  collectionId: string
  onDelete: (documentId: string) => void
  onPreview: (document: Document) => void
}

export function DocumentList({ documents, collectionId, onDelete, onPreview }: DocumentListProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pdf: 'text-red-500 bg-red-50',
      docx: 'text-blue-500 bg-blue-50',
      md: 'text-purple-500 bg-purple-50',
      txt: 'text-gray-500 bg-gray-100',
    }
    return colors[type] || 'text-gray-500 bg-gray-100'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-400" />
      case 'processing':
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string, chunkCount: number, progress: number) => {
    switch (status) {
      case 'pending':
        return '等待处理'
      case 'processing':
        return `${progress}%`
      case 'completed':
        return `${chunkCount} 片段`
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        暂无文档
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group bg-white rounded-lg p-3 border hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded ${getFileTypeColor(doc.file_type)}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {doc.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{formatFileSize(doc.file_size)}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <div className="flex items-center gap-1">
                  {getStatusIcon(doc.status)}
                  <span>{getStatusText(doc.status, doc.chunk_count, doc.progress || 0)}</span>
                </div>
              </div>
              {/* 进度条 */}
              {doc.status === 'processing' && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${doc.progress || 0}%` }}
                  />
                </div>
              )}
              {doc.status === 'failed' && doc.error_message && (
                <p className="text-xs text-red-500 mt-1 truncate">
                  {doc.error_message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onPreview(doc)}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                title="预览"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(doc.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
