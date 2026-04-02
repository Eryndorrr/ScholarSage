import { useMutation } from '@tanstack/react-query'
import { queryService } from '../services/queryService'
import type { QueryRequest, QueryResponse } from '../types/query'

interface QueryOptions {
  onSuccess?: (response: QueryResponse) => void
  onError?: (error: Error) => void
}

export function useQuery() {
  const mutation = useMutation({
    mutationFn: (request: QueryRequest) => queryService.query(request),
  })

  const query = (request: QueryRequest, options?: QueryOptions) => {
    mutation.mutate(request, {
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    })
  }

  return {
    query,
    data: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}
