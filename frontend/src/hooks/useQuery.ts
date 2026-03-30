import { useMutation } from '@tanstack/react-query'
import { queryService } from '../services/queryService'
import type { QueryRequest } from '../types/query'

export function useQuery() {
  const mutation = useMutation({
    mutationFn: (request: QueryRequest) => queryService.query(request),
  })

  return {
    query: mutation.mutate,
    data: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}