import { useState, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'

interface DocumentUploadProps {
  collectionId: string
  onUploadComplete: () => void
}

export function DocumentUpload({ collectionId, onUploadComplete }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const allowedTypes = ['.pdf', '.md', '.docx']
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!allowedTypes.includes(ext)) {
      setError('只支持 PDF、Markdown、Word 文档')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/collections/${collectionId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || '上传失败')
      }

      onUploadComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.docx"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            上传中...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            上传文档
          </>
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded text-sm">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        支持 PDF、Markdown、Word 文档
      </p>
    </div>
  )
}
