import type { Source } from './document'

export interface QueryRequest {
  question: string
  collection_id?: string
  session_id?: string
  search_all?: boolean
  top_k?: number
  include_sources?: boolean
  use_hybrid?: boolean  // 是否使用混合检索
  use_rerank?: boolean  // 是否使用重排序
}

export interface QueryResponse {
  answer: string
  sources: Source[]
  confidence: number
  response_time: number
}
