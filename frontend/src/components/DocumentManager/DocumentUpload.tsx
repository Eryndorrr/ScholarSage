import { useState, useRef } from 'react'
import { Upload, X, Loader2, CheckCircle, FileText } from 'lucide-react'

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface DocumentUploadProps {
  collectionId: string
  onUploadComplete: () => void
}

export function DocumentUpload({ collectionId, onUploadComplete }: DocumentUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const allowedTypes = ['.pdf', '.md', '.docx']
    const validFiles: UploadFile[] = []

    for (const file of files) {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
      if (allowedTypes.includes(ext)) {
        validFiles.push({ file, status: 'pending' })
      }
    }

    if (validFiles.length === 0) {
      alert('请选择支持的文件格式：PDF、Markdown、Word')
      return
    }

    setUploadFiles(validFiles)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadFilesToServer = async () => {
    if (uploadFiles.length === 0) return

    setIsUploading(true)

    for (let i = 0; i < uploadFiles.length; i++) {
      const uploadFile = uploadFiles[i]

      setUploadFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading' as const } : f
      ))

      try {
        const formData = new FormData()
        formData.append('file', uploadFile.file)

        const response = await fetch(`/api/collections/${collectionId}/documents`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || '上传失败')
        }

        setUploadFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'success' as const } : f
        ))
      } catch (err) {
        setUploadFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error' as const, error: err instanceof Error ? err.message : '上传失败' } : f
        ))
      }
    }

    setIsUploading(false)
    onUploadComplete()

    setTimeout(() => {
      setUploadFiles([])
    }, 1500)
  }

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, idx) => idx !== index))
  }

  const successCount = uploadFiles.filter(f => f.status === 'success').length
  const errorCount = uploadFiles.filter(f => f.status === 'error').length

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.docx"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* 待上传文件列表 */}
      {uploadFiles.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {uploadFiles.length} 个文件
              {successCount > 0 && <span className="text-green-500 ml-1">({successCount} 成功)</span>}
              {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} 失败)</span>}
            </span>
            {!isUploading && (
              <button
                onClick={() => setUploadFiles([])}
                className="text-gray-400 hover:text-gray-600"
              >
                清空
              </button>
            )}
          </div>

          <div className="max-h-32 overflow-y-auto space-y-1">
            {uploadFiles.map((uf, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-600">{uf.file.name}</span>

                {uf.status === 'pending' && !isUploading && (
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {uf.status === 'uploading' && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
                {uf.status === 'success' && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                )}
                {uf.status === 'error' && (
                  <span className="text-red-500">失败</span>
                )}
              </div>
            ))}
          </div>

          {uploadFiles.some(f => f.status === 'pending') && (
            <button
              onClick={uploadFilesToServer}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  开始上传
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all text-sm"
        >
          <Upload className="w-4 h-4" />
          选择文件
        </button>
      )}

      <p className="text-xs text-gray-400 text-center">
        支持 PDF、Markdown、Word
      </p>
    </div>
  )
}
