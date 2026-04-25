export interface Citation {
  id: string
  paper_id: string
  cited_title: string | null
  cited_authors: string[] | null
  cited_year: number | null
  cited_venue: string | null
  location: string | null
  bibtex_raw: string | null
}

export interface CitationListResponse {
  citations: Citation[]
  total: number
}

export interface BibTeXExportRequest {
  paper_ids: string[]
}

export interface BibTeXExportResponse {
  bibtex_entries: string[]
}
