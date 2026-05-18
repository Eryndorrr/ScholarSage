import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../stores/uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      middlePanelTab: 'documents',
      selectedPaperId: null,
      previewDocument: null,
      showSettings: false,
    })
  })

  it('should initialize with default values', () => {
    const state = useUIStore.getState()
    expect(state.middlePanelTab).toBe('documents')
    expect(state.selectedPaperId).toBeNull()
    expect(state.previewDocument).toBeNull()
    expect(state.showSettings).toBe(false)
  })

  it('should set middle panel tab', () => {
    useUIStore.getState().setMiddlePanelTab('papers')
    expect(useUIStore.getState().middlePanelTab).toBe('papers')
  })

  it('should set selected paper id', () => {
    useUIStore.getState().setSelectedPaperId('paper-1')
    expect(useUIStore.getState().selectedPaperId).toBe('paper-1')
  })

  it('should set preview document', () => {
    const doc = { id: 'doc-1', title: 'Test', file_type: 'pdf' }
    useUIStore.getState().setPreviewDocument(doc)
    expect(useUIStore.getState().previewDocument).toEqual(doc)
  })

  it('should toggle settings', () => {
    useUIStore.getState().setShowSettings(true)
    expect(useUIStore.getState().showSettings).toBe(true)
  })
})
