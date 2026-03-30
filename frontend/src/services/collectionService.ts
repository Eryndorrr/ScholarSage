import { apiClient } from './api'
import type { Collection, CollectionCreate } from '../types/collection'

export const collectionService = {
  async list(): Promise<Collection[]> {
    const response = await apiClient.get<{ collections: Collection[] }>('/api/collections')
    return response.data.collections
  },

  async get(id: string): Promise<Collection> {
    const response = await apiClient.get<Collection>(`/api/collections/${id}`)
    return response.data
  },

  async create(data: CollectionCreate): Promise<Collection> {
    const response = await apiClient.post<Collection>('/api/collections', data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/collections/${id}`)
  },
}