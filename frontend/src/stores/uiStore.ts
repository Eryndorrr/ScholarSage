import { create } from 'zustand'

type MiddlePanelTab = 'documents' | 'papers'

interface UIState {
  middlePanelTab: MiddlePanelTab
  selectedPaperId: string | null
  previewDocument: { id: string; title: string; file_type: string } | null
  showSettings: boolean

  setMiddlePanelTab: (tab: MiddlePanelTab) => void
  setSelectedPaperId: (id: string | null) => void
  setPreviewDocument: (doc: UIState['previewDocument']) => void
  setShowSettings: (show: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  middlePanelTab: 'documents',
  selectedPaperId: null,
  previewDocument: null,
  showSettings: false,

  setMiddlePanelTab: (tab) => set({ middlePanelTab: tab }),
  setSelectedPaperId: (id) => set({ selectedPaperId: id }),
  setPreviewDocument: (doc) => set({ previewDocument: doc }),
  setShowSettings: (show) => set({ showSettings: show }),
}))
