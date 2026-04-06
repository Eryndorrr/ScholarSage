import { apiClient } from './api'
import type {
  CitationGraphData,
  TopicClusterData,
  KeywordNetworkData,
  GraphStats,
  PaperExternalRefsResponse,
} from '../types/graph'

export const graphService = {
  /**
   * 获取引用关系图谱
   * @param includeExternal 是否包含外部参考文献（默认 false）
   * @param minExternalCitations 外部文献最少被引次数（默认 2）
   */
  async getCitationGraphData(
    collectionId: string,
    includeExternal: boolean = false,
    minExternalCitations: number = 2
  ): Promise<CitationGraphData> {
    const response = await apiClient.get<CitationGraphData>(
      `/api/graph/citation/${collectionId}`,
      { params: { include_external: includeExternal, min_external_citations: minExternalCitations } }
    )
    return response.data
  },

  /**
   * 获取指定论文的外部引用文献（按需加载）
   */
  async getPaperExternalRefs(
    collectionId: string,
    paperId: string
  ): Promise<PaperExternalRefsResponse> {
    const response = await apiClient.get<PaperExternalRefsResponse>(
      `/api/graph/citation/${collectionId}/external/${paperId}`
    )
    return response.data
  },

  /**
   * 获取主题聚类
   */
  async getTopicClustersData(collectionId: string): Promise<TopicClusterData> {
    const response = await apiClient.get<TopicClusterData>(
      `/api/graph/topic-clusters/${collectionId}`
    )
    return response.data
  },

  /**
   * 获取关键词网络
   */
  async getKeywordNetwork(collectionId: string): Promise<KeywordNetworkData> {
    const response = await apiClient.get<KeywordNetworkData>(
      `/api/graph/keywords/${collectionId}`
    )
    return response.data
  },

  /**
   * 获取图谱统计信息
   */
  async getGraphStats(collectionId: string): Promise<GraphStats> {
    const response = await apiClient.get<GraphStats>(
      `/api/graph/stats/${collectionId}`
    )
    return response.data
  },
}
