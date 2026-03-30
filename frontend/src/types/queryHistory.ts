export interface QueryHistoryItem {
  id: string
  collection_id: string
  question: string
  answer: string
  sources: Array<{
    document_id: string
    title: string
    snippet: string
    relevance_score: number
  }>
  confidence: number
  response_time: number
  query_time: string
}

export interface QueryHistoryListResponse {
  history: QueryHistoryItem[]
  total: number
}
