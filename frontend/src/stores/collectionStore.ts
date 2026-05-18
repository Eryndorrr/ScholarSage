import { create } from 'zustand'

interface CollectionState {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

export const useCollectionStore = create<CollectionState>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
}))
