export interface Paper {
  id: string
  document_id: string
  title: string | null
  authors: string[]
  abstract: string | null
  keywords: string[]
  publication_year: number | null
  doi: string | null
  venue: string | null
  created_at?: string
  updated_at?: string
}

export interface PaperWithCitations extends Paper {
  citations_count: number
}

export interface PaperListResponse {
  papers: Paper[]
  total: number
  page?: number
  page_size?: number
  total_pages?: number
}

export interface PaperQueryParams {
  search?: string
  year_from?: number
  year_to?: number
  venue?: string
  sort_by?: 'created_at' | 'publication_year' | 'title'
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export interface PaperCreate {
  document_id: string
  title?: string
  authors?: string[]
  abstract?: string
  keywords?: string[]
  publication_year?: number
  doi?: string
  venue?: string
}

export interface PaperUpdate {
  title?: string
  authors?: string[]
  abstract?: string
  keywords?: string[]
  publication_year?: number
  doi?: string
  venue?: string
}
