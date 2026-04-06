/**
 * 知识图谱相关类型定义
 */

// 论文节点
export interface PaperNode {
  id: string
  title: string
  authors: string[]
  year: number | null
  keywords: string[]
  outgoing_citations: number  // 引用了多少文献
  incoming_citations: number  // 被引用次数
  external_cite_count: number // 外部引用数量（仅内部节点）
  doi: string | null
  type: 'internal' | 'external'  // 内部论文 or 外部参考文献
}

// 引用边
export interface CitationEdge {
  source: string
  target: string
  type: 'internal_cite' | 'external_cite'  // 内部引用 or 外部引用
  location?: string
}

// 引用关系图谱数据
export interface CitationGraphData {
  nodes: PaperNode[]
  edges: CitationEdge[]
  external_refs_map: Record<string, string[]>  // paper_id -> 外部引用ID列表
  stats: {
    total_papers: number           // 知识库内论文数
    external_references: number    // 显示的外部参考文献数
    total_external_refs: number    // 总外部文献数
    internal_citations: number     // 内部引用数
    external_citations: number     // 外部引用数
    total_citations: number
  }
}

// 外部引用详情
export interface ExternalRef {
  id: string
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  location: string | null
  type: 'external'
}

// 论文外部引用响应
export interface PaperExternalRefsResponse {
  paper_id: string
  paper_title: string
  external_refs: ExternalRef[]
  count: number
}

// 主题聚类
export interface TopicCluster {
  id: string
  name: string
  keywords: string[]
  papers: string[]
  paper_count: number
  paper_details: Array<{
    title: string
    authors: string[]
    year: number | null
  }>
}

// 主题聚类数据
export interface TopicClusterData {
  clusters: TopicCluster[]
  top_keywords: Array<{
    keyword: string
    count: number
    papers: string[]
  }>
  stats: {
    total_papers: number
    total_clusters: number
    total_keywords: number
  }
}

// 关键词节点
export interface KeywordNode {
  id: string
  name: string
  count: number
  papers: string[]
}

// 关键词边
export interface KeywordEdge {
  source: string
  target: string
  weight: number
}

// 关键词网络数据
export interface KeywordNetworkData {
  nodes: KeywordNode[]
  edges: KeywordEdge[]
  stats: {
    total_keywords: number
    total_connections: number
  }
}

// 图谱统计信息
export interface GraphStats {
  paper_count: number
  citation_count: number
  keyword_count: number
  has_graph_data: boolean
}
