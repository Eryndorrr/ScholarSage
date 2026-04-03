import type { Source } from './document'

export interface QueryRequest {
  question: string
  collection_id?: string
  session_id?: string
  search_all?: boolean
  top_k?: number
  include_sources?: boolean
}

export interface QueryResponse {
  answer: string
  sources: Source[]
  confidence: number
  response_time: number
}
