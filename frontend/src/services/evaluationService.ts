import type {
  Evaluation,
  EvaluationDetail,
  EvaluationListResponse,
  EvaluationStats,
  EvaluationCreateRequest,
  EvaluationCompareResponse
} from '../types/evaluation'

const API_BASE = '/api/evaluation'

export const evaluationService = {
  // 启动评估
  async runEvaluation(request: EvaluationCreateRequest): Promise<Evaluation> {
    const response = await fetch(`${API_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to start evaluation')
    }
    return response.json()
  },

  // 获取评估详情
  async getEvaluation(evaluationId: string): Promise<EvaluationDetail> {
    const response = await fetch(`${API_BASE}/${evaluationId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch evaluation')
    }
    return response.json()
  },

  // 获取知识库的评估列表
  async listEvaluations(
    collectionId: string,
    status?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<EvaluationListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    })
    if (status) params.append('status', status)

    const response = await fetch(
      `${API_BASE}/collection/${collectionId}?${params}`
    )
    if (!response.ok) {
      throw new Error('Failed to fetch evaluations')
    }
    return response.json()
  },

  // 获取知识库评估统计
  async getStats(collectionId: string): Promise<EvaluationStats> {
    const response = await fetch(
      `${API_BASE}/collection/${collectionId}/stats`
    )
    if (!response.ok) {
      throw new Error('Failed to fetch evaluation stats')
    }
    return response.json()
  },

  // 对比评估结果
  async compareEvaluations(
    evaluationIds: string[]
  ): Promise<EvaluationCompareResponse> {
    const response = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation_ids: evaluationIds })
    })
    if (!response.ok) {
      throw new Error('Failed to compare evaluations')
    }
    return response.json()
  },

  // 删除评估
  async deleteEvaluation(evaluationId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${evaluationId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error('Failed to delete evaluation')
    }
  }
}
