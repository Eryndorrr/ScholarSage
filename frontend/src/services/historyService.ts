import type { QueryHistoryListResponse } from '../types/queryHistory'

export const historyService = {
  async getHistory(collectionId: string, limit: number = 20): Promise<QueryHistoryListResponse> {
    const response = await fetch(`/api/query/history/${collectionId}?limit=${limit}`)
    if (!response.ok) {
      throw new Error('Failed to fetch query history')
    }
    return response.json()
  },

  async deleteItem(historyId: string): Promise<void> {
    const response = await fetch(`/api/query/history/${historyId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete query history')
    }
  },

  async clearHistory(collectionId: string): Promise<{ deleted_count: number }> {
    const response = await fetch(`/api/query/history/collection/${collectionId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to clear query history')
    }
    return response.json()
  },
}
