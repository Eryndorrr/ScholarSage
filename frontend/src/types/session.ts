export interface SessionMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string
  web_search_results?: string  // JSON 格式的网络搜索结果
  created_at: string
}

export interface Session {
  id: string
  collection_id: string
  title: string | null
  summary: string | null
  message_count: number
  is_active: boolean
  web_search_enabled: boolean
  created_at: string
  updated_at: string
  messages?: SessionMessage[]
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
}
