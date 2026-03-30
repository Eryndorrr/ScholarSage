import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionService } from '../services/collectionService'

export function useCollections() {
  const queryClient = useQueryClient()

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionService.list,
  })

  const createMutation = useMutation({
    mutationFn: collectionService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: collectionService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  return {
    collections,
    isLoading,
    createCollection: createMutation.mutate,
    deleteCollection: deleteMutation.mutate,
  }
}