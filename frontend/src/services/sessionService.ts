import { apiClient } from './api'
import type { Session, SessionListResponse } from '../types/session'

export const sessionService = {
  async create(collectionId: string, title?: string, webSearchEnabled?: boolean): Promise<Session> {
    const response = await apiClient.post<Session>('/api/sessions', {
      collection_id: collectionId,
      title,
      web_search_enabled: webSearchEnabled
    })
    return response.data
  },

  async list(collectionId: string, limit: number = 20, offset: number = 0): Promise<SessionListResponse> {
    const response = await apiClient.get<SessionListResponse>('/api/sessions', {
      params: { collection_id: collectionId, limit, offset }
    })
    return response.data
  },

  async get(sessionId: string): Promise<Session> {
    const response = await apiClient.get<Session>(`/api/sessions/${sessionId}`)
    return response.data
  },

  async update(sessionId: string, data: { title?: string; web_search_enabled?: boolean }): Promise<Session> {
    const response = await apiClient.put<Session>(`/api/sessions/${sessionId}`, data)
    return response.data
  },

  async delete(sessionId: string): Promise<void> {
    await apiClient.delete(`/api/sessions/${sessionId}`)
  },

  async clearAll(collectionId: string): Promise<{ deleted_count: number }> {
    const response = await apiClient.delete(`/api/sessions/collection/${collectionId}`)
    return response.data
  }
}
