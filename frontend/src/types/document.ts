export type FileType = 'pdf' | 'docx' | 'md' | 'txt'

export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Document {
  id: string
  collection_id: string
  title: string
  file_type: FileType
  file_size: number
  file_hash: string | null
  status: ProcessStatus
  progress: number
  chunk_count: number
  error_message: string | null
  has_paper: boolean  // 是否已解析为论文
  upload_time: string
}

export interface DuplicateCheckResponse {
  is_duplicate: boolean
  existing_document: Document | null
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
