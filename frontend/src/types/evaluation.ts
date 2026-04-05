export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface EvaluationParameters {
  chunk_size?: number
  chunk_overlap?: number
  top_k?: number
  embedding_model?: string
  llm_model?: string
}

export interface ContextSource {
  content: string
  document_id: string
  document_name: string
  chunk_index: number
  page?: number
  distance: number
}

export interface QuestionResult {
  question: string
  answer: string
  contexts: string[]
  context_sources?: ContextSource[]
  faithfulness?: number
  answer_relevancy?: number
  context_precision?: number
  context_recall?: number
  error?: string
}

export interface Evaluation {
  id: string
  collection_id: string
  status: EvaluationStatus
  parameters: EvaluationParameters
  sample_questions: string[]
  metrics?: {
    faithfulness?: number
    answer_relevancy?: number
    context_precision?: number
    context_recall?: number
  }
  detailed_results?: QuestionResult[]
  total_questions: number
  processed_questions: number
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
  execution_time?: number
}

export interface EvaluationDetail extends Evaluation {
  detailed_results: QuestionResult[]
}

export interface EvaluationListResponse {
  evaluations: Evaluation[]
  total: number
}

export interface EvaluationStats {
  total_evaluations: number
  avg_faithfulness?: number
  avg_answer_relevancy?: number
  avg_context_precision?: number
  avg_context_recall?: number
  best_parameters?: EvaluationParameters
}

export interface EvaluationCreateRequest {
  collection_id: string
  sample_questions?: string[]
  parameters?: EvaluationParameters
  sample_size?: number
}

export type EvaluationCreate = EvaluationCreateRequest

export interface EvaluationCompareResponse {
  comparisons: Array<{
    id: string
    parameters: EvaluationParameters
    metrics?: {
      faithfulness?: number
      answer_relevancy?: number
      context_precision?: number
      context_recall?: number
    }
    created_at?: string
    execution_time?: number
  }>
}
