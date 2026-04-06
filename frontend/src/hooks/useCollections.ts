import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionService } from '../services/collectionService'
import type { CollectionUpdate } from '../types/collection'

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CollectionUpdate }) =>
      collectionService.update(id, data),
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
    updateCollection: (id: string, data: CollectionUpdate) =>
      updateMutation.mutate({ id, data }),
    deleteCollection: deleteMutation.mutate,
  }
}