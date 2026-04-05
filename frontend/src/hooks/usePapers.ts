import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paperService } from '../services/paperService'
import type { PaperUpdate, PaperQueryParams } from '../types/paper'

// 获取知识库论文列表（支持搜索、过滤、排序、分页）
export function usePapers(collectionId: string | undefined, params?: PaperQueryParams) {
  return useQuery({
    queryKey: ['papers', 'collection', collectionId, params],
    queryFn: () => paperService.listPapersByCollection(collectionId!, params),
    enabled: !!collectionId,
  })
}

// 获取论文详情
export function usePaper(paperId: string | undefined) {
  return useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => paperService.getPaper(paperId!),
    enabled: !!paperId,
  })
}

// 获取论文引用
export function useCitations(paperId: string | undefined) {
  return useQuery({
    queryKey: ['citations', paperId],
    queryFn: () => paperService.getCitations(paperId!),
    enabled: !!paperId,
  })
}

// 解析论文元数据
export function useParsePaper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) => paperService.parsePaper(documentId),
    onSuccess: () => {
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['paper'] })
    },
  })
}

// 更新论文
export function useUpdatePaper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ paperId, data }: { paperId: string; data: PaperUpdate }) =>
      paperService.updatePaper(paperId, data),
    onSuccess: (_, { paperId }) => {
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] })
      queryClient.invalidateQueries({ queryKey: ['papers'] })
    },
  })
}

// 生成BibTeX
export function useGenerateBibTeX() {
  return useMutation({
    mutationFn: (paperIds: string[]) => paperService.generateBibTeX(paperIds),
  })
}

// 删除论文
export function useDeletePaper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paperId: string) => paperService.deletePaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] })
    },
  })
}
