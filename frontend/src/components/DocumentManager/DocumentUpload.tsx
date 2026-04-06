import { useState, useRef } from 'react'
import { Upload, X, Loader2, CheckCircle, FileText, AlertTriangle } from 'lucide-react'
import { documentService } from '../../services/documentService'
import type { Document } from '../../types/document'

interface UploadFile {
  file: File
  status: 'pending' | 'checking' | 'duplicate' | 'uploading' | 'success' | 'error'
  error?: string
  existingDocument?: Document
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

    setUploadFiles(prev => [...prev, ...validFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const checkDuplicate = async (index: number) => {
    const uploadFile = uploadFiles[index]

    setUploadFiles(prev => prev.map((f, idx) =>
      idx === index ? { ...f, status: 'checking' as const } : f
    ))

    try {
      const result = await documentService.checkDuplicate(collectionId, uploadFile.file)

      if (result.is_duplicate && result.existing_document) {
        setUploadFiles(prev => prev.map((f, idx) =>
          idx === index ? {
            ...f,
            status: 'duplicate' as const,
            existingDocument: result.existing_document!
          } : f
        ))
      } else {
        setUploadFiles(prev => prev.map((f, idx) =>
          idx === index ? { ...f, status: 'pending' as const, existingDocument: undefined } : f
        ))
      }
    } catch (err) {
      // 检查失败时继续上传
      setUploadFiles(prev => prev.map((f, idx) =>
        idx === index ? { ...f, status: 'pending' as const } : f
      ))
    }
  }

  const uploadSingleFile = async (index: number, forceUpload: boolean = false) => {
    const uploadFile = uploadFiles[index]

    setUploadFiles(prev => prev.map((f, idx) =>
      idx === index ? { ...f, status: 'uploading' as const } : f
    ))

    try {
      await documentService.upload(collectionId, uploadFile.file, forceUpload)

      setUploadFiles(prev => prev.map((f, idx) =>
        idx === index ? { ...f, status: 'success' as const } : f
      ))
    } catch (err: any) {
      if (err.isDuplicate) {
        setUploadFiles(prev => prev.map((f, idx) =>
          idx === index ? {
            ...f,
            status: 'duplicate' as const,
            error: err.message,
            existingDocument: err.existingDocument
          } : f
        ))
      } else {
        setUploadFiles(prev => prev.map((f, idx) =>
          idx === index ? { ...f, status: 'error' as const, error: err.message || '上传失败' } : f
        ))
      }
    }
  }

  const uploadFilesToServer = async () => {
    if (uploadFiles.length === 0) return

    setIsUploading(true)

    // 先检查所有待上传文件的重复情况
    const pendingIndices = uploadFiles
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f.status === 'pending')
      .map(({ idx }) => idx)

    for (const idx of pendingIndices) {
      await checkDuplicate(idx)
    }

    // 上传非重复的文件
    const toUploadIndices = uploadFiles
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f.status === 'pending')
      .map(({ idx }) => idx)

    for (const idx of toUploadIndices) {
      await uploadSingleFile(idx)
    }

    setIsUploading(false)

    // 只有当所有文件都成功时才刷新
    const successCount = uploadFiles.filter(f => f.status === 'success').length
    if (successCount > 0) {
      onUploadComplete()
    }
  }

  const forceUploadFile = async (index: number) => {
    await uploadSingleFile(index, true)
    onUploadComplete()
  }

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, idx) => idx !== index))
  }

  const clearCompleted = () => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'success'))
  }

  const successCount = uploadFiles.filter(f => f.status === 'success').length
  const errorCount = uploadFiles.filter(f => f.status === 'error').length
  const duplicateCount = uploadFiles.filter(f => f.status === 'duplicate').length
  const pendingCount = uploadFiles.filter(f => f.status === 'pending' || f.status === 'checking').length

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
              {duplicateCount > 0 && <span className="text-amber-500 ml-1">({duplicateCount} 重复)</span>}
            </span>
            {!isUploading && (successCount > 0 || errorCount > 0) && (
              <button
                onClick={clearCompleted}
                className="text-gray-400 hover:text-gray-600"
              >
                清空已完成
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {uploadFiles.map((uf, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 p-2 rounded text-xs ${
                  uf.status === 'duplicate' ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-600">{uf.file.name}</span>

                {/* 状态指示 */}
                {(uf.status === 'pending' || uf.status === 'checking') && !isUploading && (
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {uf.status === 'checking' && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
                {uf.status === 'uploading' && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
                {uf.status === 'success' && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                )}
                {uf.status === 'error' && (
                  <span className="text-red-500 text-[10px]">{uf.error || '失败'}</span>
                )}
                {uf.status === 'duplicate' && (
                  <div className="flex items-center gap-1">
                    {uf.existingDocument && (
                      <span className="text-amber-600 text-[10px]">
                        已存在
                      </span>
                    )}
                    <button
                      onClick={() => forceUploadFile(idx)}
                      className="text-blue-500 hover:text-blue-600 text-[10px] underline"
                    >
                      强制上传
                    </button>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 重复文件提示 */}
          {duplicateCount > 0 && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>检测到 {duplicateCount} 个重复文件</p>
                <p className="text-amber-600 mt-0.5">点击"强制上传"可重新上传，或点击 ✕ 移除</p>
              </div>
            </div>
          )}

          {pendingCount > 0 && (
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
        支持 PDF、Markdown、Word · 自动检测重复文件
      </p>
    </div>
  )
}
