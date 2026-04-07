import { useState, useCallback, useRef } from 'react'
import { queryService } from '../services/queryService'
import type { QueryRequest, QueryResponse, Source, WebSearchResult } from '../types/query'

interface UseQueryOptions {
  onSuccess?: (response: QueryResponse) => void
  onError?: (error: Error) => void
}

export function useQuery() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 非流式查询
  const query = useCallback((request: QueryRequest, options?: UseQueryOptions) => {
    setIsLoading(true)
    setError(null)

    queryService.query(request)
      .then((response) => {
        options?.onSuccess?.(response)
      })
      .catch((err) => {
        setError(err)
        options?.onError?.(err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // 流式查询
  const queryStream = useCallback((
    request: QueryRequest,
    callbacks: {
      onContent: (text: string) => void
      onSources?: (sources: Source[]) => void
      onWebResults?: (results: WebSearchResult[]) => void
      onDone?: () => void
      onError?: (error: string) => void
    }
  ) => {
    setIsLoading(true)
    setError(null)

    // 中断之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = queryService.queryStream(request, {
      onContent: callbacks.onContent,
      onSources: callbacks.onSources,
      onWebResults: callbacks.onWebResults,
      onDone: () => {
        setIsLoading(false)
        callbacks.onDone?.()
      },
      onError: (errorMsg) => {
        setIsLoading(false)
        setError(new Error(errorMsg))
        callbacks.onError?.(errorMsg)
      },
      onCancelled: () => {
        setIsLoading(false)
      },
    })

    abortControllerRef.current = controller
    return controller
  }, [])

  // 中断查询
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }, [])

  return {
    query,
    queryStream,
    abort,
    isLoading,
    error,
  }
}
