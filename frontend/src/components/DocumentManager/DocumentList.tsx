import { FileText, Trash2, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { Document } from '../../types/document'

interface DocumentListProps {
  documents: Document[]
  onDelete: (documentId: string) => void
}

export function DocumentList({ documents, onDelete }: DocumentListProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileTypeIcon = (type: string) => {
    const colors: Record<string, string> = {
      pdf: 'text-red-500',
      docx: 'text-blue-500',
      md: 'text-gray-500',
      txt: 'text-gray-400',
    }
    return colors[type] || 'text-gray-400'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string, chunkCount: number) => {
    switch (status) {
      case 'pending':
        return '等待处理'
      case 'processing':
        return '处理中...'
      case 'completed':
        return `${chunkCount} 个片段`
      case 'failed':
        return '处理失败'
      default:
        return status
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无文档，点击上方按钮上传
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow"
        >
          <FileText className={`w-5 h-5 ${getFileTypeIcon(doc.file_type)}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {doc.title}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{formatFileSize(doc.file_size)}</span>
              <span>·</span>
              <span>{formatDate(doc.upload_time)}</span>
              <span>·</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(doc.status)}
                <span>{getStatusText(doc.status, doc.chunk_count)}</span>
              </div>
            </div>
            {doc.status === 'failed' && doc.error_message && (
              <p className="text-xs text-red-500 mt-1 truncate">
                {doc.error_message}
              </p>
            )}
          </div>
          <button
            onClick={() => onDelete(doc.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
