export interface SessionMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string
  created_at: string
}

export interface Session {
  id: string
  collection_id: string
  title: string | null
  summary: string | null
  message_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  messages?: SessionMessage[]
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
}
