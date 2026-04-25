import type { Document, FileType, DuplicateCheckResponse } from '../types/document'
import { getAuthHeaders } from '../utils/authFetch'

export interface UploadResponse {
  id: string
  collection_id: string
  title: string
  file_type: FileType
  file_size: number
  upload_time: string
}

export const documentService = {
  async checkDuplicate(collectionId: string, file: File): Promise<DuplicateCheckResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/collections/${collectionId}/documents/check-duplicate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Duplicate check failed')
    }

    return response.json()
  },

  async upload(collectionId: string, file: File, skipDuplicateCheck: boolean = false): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const url = `/api/collections/${collectionId}/documents${skipDuplicateCheck ? '?skip_duplicate_check=true' : ''}`

    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      // 处理重复文件错误
      if (response.status === 409) {
        const duplicateError = new Error(error.detail?.message || '检测到重复文件')
        ;(duplicateError as any).isDuplicate = true
        ;(duplicateError as any).existingDocument = error.detail?.existing_document
        throw duplicateError
      }
      throw new Error(error.detail || 'Upload failed')
    }

    return response.json()
  },

  async list(collectionId: string): Promise<Document[]> {
    const response = await fetch(`/api/collections/${collectionId}/documents`, {
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      throw new Error('Failed to fetch documents')
    }
    return response.json()
  },

  async delete(collectionId: string, documentId: string): Promise<void> {
    const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      throw new Error('Failed to delete document')
    }
  },

  async getContent(collectionId: string, documentId: string): Promise<{ title: string; content: string; char_count: number }> {
    const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}/content`, {
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail || '获取文档内容失败')
    }
    return response.json()
  },
}
