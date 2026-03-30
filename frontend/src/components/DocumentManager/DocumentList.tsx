import { FileText, Trash2 } from 'lucide-react'
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
            <p className="text-xs text-gray-500">
              {formatFileSize(doc.file_size)} · {formatDate(doc.upload_time)}
            </p>
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
