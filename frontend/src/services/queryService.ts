import { apiClient } from './api'
import type { QueryRequest, QueryResponse, Source, WebSearchResult } from '../types/query'

export interface StreamCallbacks {
  onContent: (text: string) => void
  onSources?: (sources: Source[]) => void
  onWebResults?: (results: WebSearchResult[]) => void
  onDone?: (confidence: number, responseTime: number) => void
  onError?: (error: string) => void
  onCancelled?: () => void
}

export const queryService = {
  async query(request: QueryRequest): Promise<QueryResponse> {
    const response = await apiClient.post<QueryResponse>('/api/query', request)
    return response.data
  },

  /**
   * 流式查询（支持中断）
   * 返回 AbortController 用于中断请求
   */
  queryStream(
    request: QueryRequest,
    callbacks: StreamCallbacks
  ): AbortController {
    const controller = new AbortController()

    // 使用 fetch 而不是 axios，因为 axios 对 SSE 支持不好
    fetch('/api/query/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                switch (data.type) {
                  case 'content':
                    callbacks.onContent(data.text)
                    break
                  case 'sources':
                    callbacks.onSources?.(data.data)
                    break
                  case 'web_results':
                    callbacks.onWebResults?.(data.data)
                    break
                  case 'done':
                    callbacks.onDone?.(data.confidence, data.response_time)
                    break
                  case 'cancelled':
                    callbacks.onCancelled?.()
                    break
                  case 'error':
                    callbacks.onError?.(data.message)
                    break
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e)
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          callbacks.onCancelled?.()
        } else {
          callbacks.onError?.(error.message)
        }
      })

    return controller
  },
}
