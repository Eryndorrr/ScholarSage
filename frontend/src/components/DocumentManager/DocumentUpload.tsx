import { useState, useRef } from 'react'
import { Upload, X, Loader2, CheckCircle, FileText, AlertTriangle, Clock } from 'lucide-react'
import { documentService } from '../../services/documentService'
import type { Document } from '../../types/document'

interface UploadFile {
  file: File
  status: 'pending' | 'checking' | 'duplicate' | 'uploading' | 'submitted' | 'success' | 'error'
  error?: string
  existingDocument?: Document
  uploadedDocId?: string  // 上传成功后返回的文档 ID
}

interface DocumentUploadProps {
  collectionId: string
  onUploadComplete: (newDocIds?: string[]) => void
}

export function DocumentUpload({ collectionId, onUploadComplete }: DocumentUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件添加的通用逻辑
  const processFiles = (files: File[]) => {
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
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    processFiles(files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 拖拽事件处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isUploading) return

    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
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
      const result = await documentService.upload(collectionId, uploadFile.file, forceUpload)

      setUploadFiles(prev => prev.map((f, idx) =>
        idx === index ? { ...f, status: 'submitted' as const, uploadedDocId: result.id } : f
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

    // 上传完成后刷新列表，传递新文档 ID 用于 SSE 监听
    const submittedFiles = uploadFiles.filter(f => f.status === 'submitted')
    if (submittedFiles.length > 0) {
      const newDocIds = submittedFiles.map(f => f.uploadedDocId).filter(Boolean) as string[]
      onUploadComplete(newDocIds)
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
    setUploadFiles(prev => prev.filter(f => f.status !== 'success' && f.status !== 'submitted'))
  }

  const successCount = uploadFiles.filter(f => f.status === 'success' || f.status === 'submitted').length
  const submittedCount = uploadFiles.filter(f => f.status === 'submitted').length
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
            <span className="text-gray-500 dark:text-gray-400">
              {uploadFiles.length} 个文件
              {submittedCount > 0 && <span className="text-blue-500 ml-1">({submittedCount} 处理中)</span>}
              {successCount > submittedCount && <span className="text-green-500 ml-1">({successCount - submittedCount} 完成)</span>}
              {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} 失败)</span>}
              {duplicateCount > 0 && <span className="text-amber-500 ml-1">({duplicateCount} 重复)</span>}
            </span>
            {!isUploading && (successCount > 0 || errorCount > 0) && (
              <button
                onClick={clearCompleted}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
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
                  uf.status === 'duplicate' ? 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700' :
                  uf.status === 'submitted' ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' :
                  'bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{uf.file.name}</span>

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
                {uf.status === 'submitted' && (
                  <div className="flex items-center gap-1 text-blue-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px]">处理中</span>
                  </div>
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

          {/* 拖拽添加更多文件提示 */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-500'
                : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>拖拽文件到此处或点击添加</span>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative w-full flex flex-col items-center justify-center gap-2 px-3 py-6 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-500'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
          }`}
        >
          <Upload className={`w-6 h-6 ${isDragging ? 'scale-110' : ''} transition-transform`} />
          <span className="font-medium">
            {isDragging ? '松开以上传文件' : '拖拽文件到此处'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">或点击选择文件</span>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        支持 PDF、Markdown、Word · 自动检测重复文件
      </p>
    </div>
  )
}
