import { describe, it, expect, beforeEach } from 'vitest'
import { useCollectionStore } from '../../stores/collectionStore'

describe('collectionStore', () => {
  beforeEach(() => {
    useCollectionStore.setState({ selectedId: null })
  })

  it('should initialize with null selectedId', () => {
    expect(useCollectionStore.getState().selectedId).toBeNull()
  })

  it('should set selectedId', () => {
    useCollectionStore.getState().setSelectedId('collection-123')
    expect(useCollectionStore.getState().selectedId).toBe('collection-123')
  })

  it('should clear selectedId when set to null', () => {
    useCollectionStore.getState().setSelectedId('collection-123')
    useCollectionStore.getState().setSelectedId(null)
    expect(useCollectionStore.getState().selectedId).toBeNull()
  })
})
