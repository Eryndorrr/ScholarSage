export type FileType = 'pdf' | 'docx' | 'md' | 'txt'

export interface Document {
  id: string
  collection_id: string
  title: string
  file_type: FileType
  file_size: number
  upload_time: string
}

export interface Source {
  document_id: string
  title: string
  page: number
  snippet: string
  relevance_score: number
  collection_name: string
}