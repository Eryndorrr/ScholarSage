import type { Document, FileType } from '../types/document'

export interface UploadResponse {
  id: string
  collection_id: string
  title: string
  file_type: FileType
  file_size: number
  upload_time: string
}

export const documentService = {
  async upload(collectionId: string, file: File): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/collections/${collectionId}/documents`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Upload failed')
    }

    return response.json()
  },

  async list(collectionId: string): Promise<Document[]> {
    const response = await fetch(`/api/collections/${collectionId}/documents`)
    if (!response.ok) {
      throw new Error('Failed to fetch documents')
    }
    return response.json()
  },

  async delete(collectionId: string, documentId: string): Promise<void> {
    const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete document')
    }
  },
}
