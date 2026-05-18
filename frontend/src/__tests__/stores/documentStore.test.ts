import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore } from '../../stores/documentStore'
import type { Document } from '../../types/document'

describe('documentStore', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset()
  })

  const mockDocument: Document = {
    id: 'doc-1',
    title: 'Test Document',
    file_type: 'pdf',
    file_size: 1024,
    file_hash: null,
    status: 'completed',
    collection_id: 'col-1',
    upload_time: '2024-01-01T00:00:00Z',
    chunk_count: 10,
    progress: 100,
    error_message: null,
    has_paper: false,
  }

  it('should initialize with default values', () => {
    const state = useDocumentStore.getState()
    expect(state.documents).toEqual([])
    expect(state.total).toBe(0)
    expect(state.currentPage).toBe(1)
    expect(state.isLoading).toBe(false)
    expect(state.watchingDocIds).toEqual([])
  })

  it('should set documents', () => {
    useDocumentStore.getState().setDocuments([mockDocument])
    expect(useDocumentStore.getState().documents).toHaveLength(1)
    expect(useDocumentStore.getState().documents[0].id).toBe('doc-1')
  })

  it('should update document status', () => {
    useDocumentStore.getState().setDocuments([mockDocument])
    useDocumentStore.getState().updateDocumentStatus('doc-1', {
      status: 'processing',
      progress: 50,
    })

    const doc = useDocumentStore.getState().documents[0]
    expect(doc.status).toBe('processing')
    expect(doc.progress).toBe(50)
  })

  it('should add and remove watching doc ids', () => {
    useDocumentStore.getState().addWatchingDocIds(['doc-1', 'doc-2'])
    expect(useDocumentStore.getState().watchingDocIds).toEqual(['doc-1', 'doc-2'])

    useDocumentStore.getState().addWatchingDocIds(['doc-1', 'doc-3'])
    expect(useDocumentStore.getState().watchingDocIds).toEqual(['doc-1', 'doc-2', 'doc-3'])

    useDocumentStore.getState().removeWatchingDocId('doc-2')
    expect(useDocumentStore.getState().watchingDocIds).toEqual(['doc-1', 'doc-3'])
  })

  it('should reset all state', () => {
    useDocumentStore.getState().setDocuments([mockDocument])
    useDocumentStore.getState().setTotal(100)
    useDocumentStore.getState().setCurrentPage(5)
    useDocumentStore.getState().setIsLoading(true)
    useDocumentStore.getState().addWatchingDocIds(['doc-1'])

    useDocumentStore.getState().reset()

    const state = useDocumentStore.getState()
    expect(state.documents).toEqual([])
    expect(state.total).toBe(0)
    expect(state.currentPage).toBe(1)
    expect(state.isLoading).toBe(false)
    expect(state.watchingDocIds).toEqual([])
  })
})
