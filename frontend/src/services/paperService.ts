import { apiClient } from './api'
import type {
  Paper,
  PaperWithCitations,
  PaperListResponse,
  PaperUpdate,
  PaperQueryParams,
} from '../types/paper'
import type {
  Citation,
  CitationListResponse,
  BibTeXExportRequest,
  BibTeXExportResponse,
} from '../types/citation'

const BASE_URL = '/api/papers'

export const paperService = {
  // 解析论文元数据
  async parsePaper(documentId: string, useLlm: boolean = false, force: boolean = false): Promise<Paper> {
    const response = await apiClient.post<Paper>(
      `${BASE_URL}/parse?document_id=${documentId}&use_llm=${useLlm}&force=${force}`
    )
    return response.data
  },

  // 通过文档ID获取论文
  async getPaperByDocument(documentId: string): Promise<Paper> {
    const response = await apiClient.get<Paper>(`${BASE_URL}/by-document/${documentId}`)
    return response.data
  },

  // 获取论文详情
  async getPaper(paperId: string): Promise<PaperWithCitations> {
    const response = await apiClient.get<PaperWithCitations>(`${BASE_URL}/${paperId}`)
    return response.data
  },

  // 更新论文元数据
  async updatePaper(paperId: string, data: PaperUpdate): Promise<Paper> {
    const response = await apiClient.put<Paper>(`${BASE_URL}/${paperId}`, data)
    return response.data
  },

  // 获取论文引用列表
  async getCitations(paperId: string): Promise<CitationListResponse> {
    const response = await apiClient.get<CitationListResponse>(`${BASE_URL}/${paperId}/citations`)
    return response.data
  },

  // 添加参考文献
  async addCitation(paperId: string, citation: Partial<Citation>): Promise<Citation> {
    const response = await apiClient.post<Citation>(`${BASE_URL}/${paperId}/citations`, citation)
    return response.data
  },

  // 更新参考文献
  async updateCitation(citationId: string, citation: Partial<Citation>): Promise<Citation> {
    const response = await apiClient.put<Citation>(`${BASE_URL}/citations/${citationId}`, citation)
    return response.data
  },

  // 删除参考文献
  async deleteCitation(citationId: string): Promise<void> {
    await apiClient.delete(`${BASE_URL}/citations/${citationId}`)
  },

  // 生成BibTeX
  async generateBibTeX(paperIds: string[]): Promise<BibTeXExportResponse> {
    const response = await apiClient.post<BibTeXExportResponse>(`${BASE_URL}/generate-bibtex`, {
      paper_ids: paperIds,
    } as BibTeXExportRequest)
    return response.data
  },

  // 获取知识库的论文列表（支持搜索、过滤、排序、分页）
  async listPapersByCollection(
    collectionId: string,
    params?: PaperQueryParams
  ): Promise<PaperListResponse> {
    const queryParams = new URLSearchParams()

    if (params?.search) queryParams.append('search', params.search)
    if (params?.year_from) queryParams.append('year_from', String(params.year_from))
    if (params?.year_to) queryParams.append('year_to', String(params.year_to))
    if (params?.venue) queryParams.append('venue', params.venue)
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by)
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order)
    if (params?.page) queryParams.append('page', String(params.page))
    if (params?.page_size) queryParams.append('page_size', String(params.page_size))

    const queryString = queryParams.toString()
    const url = queryString
      ? `${BASE_URL}/collection/${collectionId}?${queryString}`
      : `${BASE_URL}/collection/${collectionId}`

    const response = await apiClient.get<PaperListResponse>(url)
    return response.data
  },

  // 删除论文
  async deletePaper(paperId: string): Promise<void> {
    await apiClient.delete(`${BASE_URL}/${paperId}`)
  },
}
