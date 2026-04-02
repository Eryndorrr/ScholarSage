export type FileType = 'pdf' | 'docx' | 'md' | 'txt'

export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Document {
  id: string
  collection_id: string
  title: string
  file_type: FileType
  file_size: number
  status: ProcessStatus
  progress: number
  chunk_count: number
  error_message: string | null
  upload_time: string
}

export interface Source {
  document_id: string
  title: string
  page: number
  snippet: string
  relevance_score: number
  collection_name?: string
  collection_id?: string
}
