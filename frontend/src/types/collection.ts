export interface Collection {
  id: string
  name: string
  description: string
  color: string
  document_count: number
  created_at: string
  updated_at: string
}

export interface CollectionCreate {
  name: string
  description?: string
  color?: string
}