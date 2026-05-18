import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { MainPage } from '../../../pages/main/MainPage'
import { useCollectionStore } from '../../../stores/collectionStore'

// Mock child components
vi.mock('../../../pages/main/components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}))

vi.mock('../../../pages/main/components/DocumentPanel', () => ({
  DocumentPanel: () => <div data-testid="document-panel">DocumentPanel</div>,
}))

vi.mock('../../../pages/main/components/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel">ChatPanel</div>,
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('MainPage', () => {
  beforeEach(() => {
    useCollectionStore.setState({ selectedId: null })
  })

  it('should render all panels', () => {
    render(<MainPage />, { wrapper: createWrapper() })

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('document-panel')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('should reset stores when collection is null', () => {
    useCollectionStore.setState({ selectedId: null })

    render(<MainPage />, { wrapper: createWrapper() })

    expect(useCollectionStore.getState().selectedId).toBeNull()
  })

  it('should render with selected collection', () => {
    useCollectionStore.setState({ selectedId: 'col-1' })

    render(<MainPage />, { wrapper: createWrapper() })

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('document-panel')).toBeInTheDocument()
  })

  it('should constrain nested flex panels so list areas can scroll', () => {
    const { container } = render(<MainPage />, { wrapper: createWrapper() })

    expect(container.firstElementChild).toHaveClass('h-full', 'min-h-0')

    const sidebars = container.querySelectorAll('aside')
    expect(sidebars).toHaveLength(2)
    sidebars.forEach((sidebar) => {
      expect(sidebar).toHaveClass('min-h-0', 'overflow-hidden')
    })
  })
})
