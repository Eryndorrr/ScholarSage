import { create } from 'zustand'
import type { Document, ProcessStatus } from '../types/document'

interface DocumentState {
  documents: Document[]
  total: number
  currentPage: number
  isLoading: boolean
  watchingDocIds: string[]

  setDocuments: (docs: Document[]) => void
  setTotal: (total: number) => void
  setCurrentPage: (page: number) => void
  setIsLoading: (loading: boolean) => void
  addWatchingDocIds: (ids: string[]) => void
  removeWatchingDocId: (id: string) => void
  updateDocumentStatus: (docId: string, status: {
    status: ProcessStatus
    progress?: number
    chunk_count?: number
    error?: string
  }) => void
  reset: () => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  total: 0,
  currentPage: 1,
  isLoading: false,
  watchingDocIds: [],

  setDocuments: (docs) => set({ documents: docs }),
  setTotal: (total) => set({ total }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  addWatchingDocIds: (ids) => set((state) => ({
    watchingDocIds: Array.from(new Set([...state.watchingDocIds, ...ids]))
  })),

  removeWatchingDocId: (id) => set((state) => ({
    watchingDocIds: state.watchingDocIds.filter(d => d !== id)
  })),

  updateDocumentStatus: (docId, status) => set((state) => ({
    documents: state.documents.map(doc =>
      doc.id === docId
        ? { ...doc, ...status, error_message: status.error ?? doc.error_message }
        : doc
    )
  })),

  reset: () => set({
    documents: [],
    total: 0,
    currentPage: 1,
    isLoading: false,
    watchingDocIds: [],
  }),
}))
