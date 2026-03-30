import { apiClient } from './api'
import type { QueryRequest, QueryResponse } from '../types/query'

export const queryService = {
  async query(request: QueryRequest): Promise<QueryResponse> {
    const response = await apiClient.post<QueryResponse>('/api/query', request)
    return response.data
  },
}