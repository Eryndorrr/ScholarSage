# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ScholarSage frontend from monolithic MainApp component to modular architecture with Zustand state management, React Router navigation, and Vitest testing.

**Architecture:** Split MainApp (520 lines, 15+ states) into page-based components using React Router. Zustand manages client state, React Query manages server data. Each page is self-contained with its own components directory.

**Tech Stack:** React 18, TypeScript, Zustand, React Router v6, React Query, Vitest, React Testing Library

---

## Phase 1: Infrastructure Layer

### Task 1.1: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install new dependencies**

```bash
cd /home/eryndor/code/Learn_RAG/frontend
npm install zustand react-router-dom
npm install -D vitest @testing-library/react @testing-library/user-event @vitest/coverage-v8 jsdom
```

- [ ] **Step 2: Verify installation**

Run: `npm list zustand react-router-dom vitest @testing-library/react`
Expected: All packages listed without errors

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add zustand, react-router-dom, and testing dependencies"
```

---

### Task 1.2: Configure Vitest

**Files:**
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create test setup file**

```typescript
// frontend/src/__tests__/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add test scripts to package.json**

Add to `scripts` section in `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 4: Verify test runner works**

Run: `npm test`
Expected: No errors (may show "No test files found")

- [ ] **Step 5: Commit**

```bash
git add frontend/vitest.config.ts frontend/src/__tests__/setup.ts frontend/package.json
git commit -m "chore: configure vitest for testing"
```

---

### Task 1.3: Create Directory Structure

**Files:**
- Create: `frontend/src/app/`
- Create: `frontend/src/pages/`
- Create: `frontend/src/stores/`

- [ ] **Step 1: Create new directories**

```bash
cd /home/eryndor/code/Learn_RAG/frontend/src
mkdir -p app
mkdir -p pages/main/components
mkdir -p pages/main/hooks
mkdir -p pages/evaluation
mkdir -p pages/graph
mkdir -p pages/dashboard
mkdir -p pages/admin
mkdir -p pages/auth
mkdir -p stores
mkdir -p __tests__/stores
mkdir -p __tests__/pages
```

- [ ] **Step 2: Verify directories exist**

Run: `ls -la frontend/src/app frontend/src/pages frontend/src/stores frontend/src/__tests__`
Expected: All directories exist

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app frontend/src/pages frontend/src/stores frontend/src/__tests__
git commit -m "chore: create frontend directory structure"
```

---

### Task 1.4: Create Zustand Stores

**Files:**
- Create: `frontend/src/stores/collectionStore.ts`
- Create: `frontend/src/stores/documentStore.ts`
- Create: `frontend/src/stores/sessionStore.ts`
- Create: `frontend/src/stores/uiStore.ts`
- Create: `frontend/src/stores/index.ts`

- [ ] **Step 1: Create collectionStore.ts**

```typescript
// frontend/src/stores/collectionStore.ts
import { create } from 'zustand'

interface CollectionState {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

export const useCollectionStore = create<CollectionState>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
}))
```

- [ ] **Step 2: Create documentStore.ts**

```typescript
// frontend/src/stores/documentStore.ts
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
```

- [ ] **Step 3: Create sessionStore.ts**

```typescript
// frontend/src/stores/sessionStore.ts
import { create } from 'zustand'
import type { Session, SessionMessage } from '../types/session'

interface SessionState {
  sessions: Session[]
  currentSession: Session | null
  messages: SessionMessage[]
  searchQuery: string
  
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
  setCurrentSession: (session: Session | null) => void
  setMessages: (messages: SessionMessage[]) => void
  updateCurrentSession: (updates: Partial<Session>) => void
  setSearchQuery: (query: string) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  searchQuery: '',
  
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((state) => ({ 
    sessions: [session, ...state.sessions] 
  })),
  removeSession: (id) => set((state) => ({
    sessions: state.sessions.filter(s => s.id !== id)
  })),
  setCurrentSession: (session) => set({ currentSession: session }),
  setMessages: (messages) => set({ messages }),
  updateCurrentSession: (updates) => set((state) => ({
    currentSession: state.currentSession 
      ? { ...state.currentSession, ...updates } 
      : null,
    sessions: state.sessions.map(s => 
      s.id === state.currentSession?.id ? { ...s, ...updates } : s
    )
  })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  reset: () => set({
    sessions: [],
    currentSession: null,
    messages: [],
    searchQuery: '',
  }),
}))
```

- [ ] **Step 4: Create uiStore.ts**

```typescript
// frontend/src/stores/uiStore.ts
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
```

- [ ] **Step 5: Create stores/index.ts**

```typescript
// frontend/src/stores/index.ts
export { useCollectionStore } from './collectionStore'
export { useDocumentStore } from './documentStore'
export { useSessionStore } from './sessionStore'
export { useUIStore } from './uiStore'
```

- [ ] **Step 6: Verify stores compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/stores/
git commit -m "feat: add zustand stores for client state management"
```

---

### Task 1.5: Write Store Tests

**Files:**
- Create: `frontend/src/__tests__/stores/collectionStore.test.ts`
- Create: `frontend/src/__tests__/stores/documentStore.test.ts`
- Create: `frontend/src/__tests__/stores/sessionStore.test.ts`
- Create: `frontend/src/__tests__/stores/uiStore.test.ts`

- [ ] **Step 1: Create collectionStore.test.ts**

```typescript
// frontend/src/__tests__/stores/collectionStore.test.ts
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
```

- [ ] **Step 2: Create documentStore.test.ts**

```typescript
// frontend/src/__tests__/stores/documentStore.test.ts
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
    status: 'completed',
    collection_id: 'col-1',
    upload_time: '2024-01-01T00:00:00Z',
    chunk_count: 10,
    progress: 100,
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
```

- [ ] **Step 3: Create sessionStore.test.ts**

```typescript
// frontend/src/__tests__/stores/sessionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../stores/sessionStore'
import type { Session } from '../../types/session'

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  const mockSession: Session = {
    id: 'session-1',
    title: 'Test Session',
    message_count: 0,
    web_search_enabled: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  it('should initialize with default values', () => {
    const state = useSessionStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.currentSession).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.searchQuery).toBe('')
  })

  it('should add session to beginning of list', () => {
    useSessionStore.getState().addSession(mockSession)
    const sessions = useSessionStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('session-1')
  })

  it('should remove session', () => {
    useSessionStore.getState().addSession(mockSession)
    useSessionStore.getState().removeSession('session-1')
    expect(useSessionStore.getState().sessions).toHaveLength(0)
  })

  it('should set current session', () => {
    useSessionStore.getState().setCurrentSession(mockSession)
    expect(useSessionStore.getState().currentSession?.id).toBe('session-1')
  })

  it('should update current session and sync to list', () => {
    useSessionStore.getState().addSession(mockSession)
    useSessionStore.getState().setCurrentSession(mockSession)
    useSessionStore.getState().updateCurrentSession({ title: 'Updated Title' })
    
    const state = useSessionStore.getState()
    expect(state.currentSession?.title).toBe('Updated Title')
    expect(state.sessions[0].title).toBe('Updated Title')
  })

  it('should set search query', () => {
    useSessionStore.getState().setSearchQuery('test query')
    expect(useSessionStore.getState().searchQuery).toBe('test query')
  })

  it('should reset all state', () => {
    useSessionStore.getState().addSession(mockSession)
    useSessionStore.getState().setCurrentSession(mockSession)
    useSessionStore.getState().setMessages([{ id: 'm1', role: 'user', content: 'test', created_at: '' }])
    useSessionStore.getState().setSearchQuery('test')
    
    useSessionStore.getState().reset()
    
    const state = useSessionStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.currentSession).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.searchQuery).toBe('')
  })
})
```

- [ ] **Step 4: Create uiStore.test.ts**

```typescript
// frontend/src/__tests__/stores/uiStore.test.ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/__tests__/stores/
git commit -m "test: add zustand store tests"
```

---

## Phase 2: Router Layer

### Task 2.1: Create Route Definitions

**Files:**
- Create: `frontend/src/app/routes.tsx`

- [ ] **Step 1: Create routes.tsx with placeholder pages**

```typescript
// frontend/src/app/routes.tsx
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { AuthGuard } from './AuthGuard'

// Placeholder components - will be replaced with actual pages
const MainPage = () => <div>Main Page (TODO)</div>
const EvaluationPage = () => <div>Evaluation Page (TODO)</div>
const GraphPage = () => <div>Graph Page (TODO)</div>
const DashboardPage = () => <div>Dashboard Page (TODO)</div>
const AdminPage = () => <div>Admin Page (TODO)</div>
const AuthPage = () => <div>Auth Page (TODO)</div>

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <MainPage /> },
      { path: 'evaluation', element: <EvaluationPage /> },
      { path: 'graph', element: <GraphPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
])
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/routes.tsx
git commit -m "feat: add route definitions"
```

---

### Task 2.2: Create AppLayout and AuthGuard

**Files:**
- Create: `frontend/src/app/AppLayout.tsx`
- Create: `frontend/src/app/AuthGuard.tsx`

- [ ] **Step 1: Create AppLayout.tsx**

```typescript
// frontend/src/app/AppLayout.tsx
import { Outlet } from 'react-router-dom'
import { Header } from '../components/Layout/Header'

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create AuthGuard.tsx**

```typescript
// frontend/src/app/AuthGuard.tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/AppLayout.tsx frontend/src/app/AuthGuard.tsx
git commit -m "feat: add AppLayout and AuthGuard components"
```

---

### Task 2.3: Migrate Existing Pages

**Files:**
- Create: `frontend/src/pages/auth/AuthPage.tsx`
- Create: `frontend/src/pages/evaluation/EvaluationPage.tsx`
- Create: `frontend/src/pages/graph/GraphPage.tsx`
- Create: `frontend/src/pages/dashboard/DashboardPage.tsx`
- Create: `frontend/src/pages/admin/AdminPage.tsx`

- [ ] **Step 1: Create pages/auth/AuthPage.tsx**

```typescript
// frontend/src/pages/auth/AuthPage.tsx
// Re-export from existing component
export { AuthPage } from '../../components/Auth/AuthPage'
```

- [ ] **Step 2: Create pages/evaluation/EvaluationPage.tsx**

```typescript
// frontend/src/pages/evaluation/EvaluationPage.tsx
import { useNavigate } from 'react-router-dom'
import { EvaluationPage as EvaluationPageComponent } from '../../components/Evaluation/EvaluationPage'

export function EvaluationPage() {
  const navigate = useNavigate()
  
  return <EvaluationPageComponent onBack={() => navigate('/')} />
}
```

- [ ] **Step 3: Create pages/graph/GraphPage.tsx**

```typescript
// frontend/src/pages/graph/GraphPage.tsx
import { useNavigate } from 'react-router-dom'
import { KnowledgeGraphPage as GraphPageComponent } from '../../components/KnowledgeGraph/KnowledgeGraphPage'

export function GraphPage() {
  const navigate = useNavigate()
  
  return <GraphPageComponent onBack={() => navigate('/')} />
}
```

- [ ] **Step 4: Create pages/dashboard/DashboardPage.tsx**

```typescript
// frontend/src/pages/dashboard/DashboardPage.tsx
import { useNavigate } from 'react-router-dom'
import { HealthDashboard as DashboardComponent } from '../../components/Dashboard/HealthDashboard'

export function DashboardPage() {
  const navigate = useNavigate()
  
  return <DashboardComponent onBack={() => navigate('/')} />
}
```

- [ ] **Step 5: Create pages/admin/AdminPage.tsx**

```typescript
// frontend/src/pages/admin/AdminPage.tsx
import { useNavigate } from 'react-router-dom'
import { AdminPage as AdminPageComponent } from '../../components/Admin/AdminPage'

export function AdminPage() {
  const navigate = useNavigate()
  
  return <AdminPageComponent onBack={() => navigate('/')} />
}
```

- [ ] **Step 6: Update routes.tsx to use actual pages**

```typescript
// frontend/src/app/routes.tsx
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { AuthGuard } from './AuthGuard'

// Pages
import { MainPage } from '../pages/main/MainPage'
import { EvaluationPage } from '../pages/evaluation/EvaluationPage'
import { GraphPage } from '../pages/graph/GraphPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { AdminPage } from '../pages/admin/AdminPage'
import { AuthPage } from '../pages/auth/AuthPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <MainPage /> },
      { path: 'evaluation', element: <EvaluationPage /> },
      { path: 'graph', element: <GraphPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
])
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: migrate existing pages to pages directory"
```

---

### Task 2.4: Update Header Navigation

**Files:**
- Modify: `frontend/src/components/Layout/Header.tsx`

- [ ] **Step 1: Update Header to use React Router navigation**

Read the current Header.tsx and replace state-based navigation with router navigation:

```typescript
// frontend/src/components/Layout/Header.tsx
// Replace props-based callbacks with useNavigate
import { useNavigate, useLocation } from 'react-router-dom'

// In the component:
const navigate = useNavigate()
const location = useLocation()

// Replace onClick handlers:
// onEvaluationClick -> onClick={() => navigate('/evaluation')}
// onGraphClick -> onClick={() => navigate('/graph')}
// onDashboardClick -> onClick={() => navigate('/dashboard')}
// onAdminClick -> onClick={() => navigate('/admin')}
```

- [ ] **Step 2: Remove navigation props from Header interface**

Update the Header component to not require navigation callback props since it now uses useNavigate internally.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Layout/Header.tsx
git commit -m "refactor: update Header to use React Router navigation"
```

---

### Task 2.5: Create New App Entry

**Files:**
- Create: `frontend/src/app/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create new App.tsx in app directory**

```typescript
// frontend/src/app/App.tsx
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AuthProvider } from '../contexts/AuthContext'
import { router } from './routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Update main.tsx to use new App**

```typescript
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Verify app builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/App.tsx frontend/src/main.tsx
git commit -m "refactor: update app entry to use React Router"
```

---

## Phase 3: MainPage Split

### Task 3.1: Create MainPage Skeleton

**Files:**
- Create: `frontend/src/pages/main/MainPage.tsx`

- [ ] **Step 1: Create MainPage.tsx with placeholder components**

```typescript
// frontend/src/pages/main/MainPage.tsx
import { useEffect } from 'react'
import { useCollectionStore } from '../../stores/collectionStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSessionStore } from '../../stores/sessionStore'
import { ResizableSidebar } from '../../components/Layout/ResizableSidebar'

// Placeholder components - will be implemented in next tasks
const SidebarPlaceholder = () => <div className="p-4">Sidebar (TODO)</div>
const DocumentPanelPlaceholder = () => <div className="p-4">Document Panel (TODO)</div>
const ChatPanelPlaceholder = () => <div className="p-4">Chat Panel (TODO)</div>

export function MainPage() {
  const selectedId = useCollectionStore((s) => s.selectedId)
  const resetDocs = useDocumentStore((s) => s.reset)
  const resetSessions = useSessionStore((s) => s.reset)

  // Reset child state when collection changes
  useEffect(() => {
    if (!selectedId) {
      resetDocs()
      resetSessions()
    }
  }, [selectedId, resetDocs, resetSessions])

  return (
    <div className="flex-1 flex overflow-hidden">
      <ResizableSidebar
        defaultWidth={256}
        minWidth={200}
        maxWidth={400}
        side="left"
        title="知识库"
      >
        <SidebarPlaceholder />
      </ResizableSidebar>

      <ResizableSidebar
        defaultWidth={400}
        minWidth={320}
        maxWidth={700}
        side="left"
        title="文档"
      >
        <DocumentPanelPlaceholder />
      </ResizableSidebar>

      <ChatPanelPlaceholder />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/main/MainPage.tsx
git commit -m "feat: add MainPage skeleton"
```

---

### Task 3.2: Extract Sidebar Component

**Files:**
- Create: `frontend/src/pages/main/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar.tsx**

```typescript
// frontend/src/pages/main/components/Sidebar.tsx
import { FolderOpen } from 'lucide-react'
import { useCollectionStore } from '../../../stores/collectionStore'
import { CollectionList } from '../../../components/CollectionManager/CollectionList'

export function Sidebar() {
  const setSelectedId = useCollectionStore((s) => s.setSelectedId)
  const selectedId = useCollectionStore((s) => s.selectedId)

  return (
    <>
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm font-medium">知识库</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <CollectionList
          onSelectCollection={setSelectedId}
          selectedId={selectedId}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update MainPage to use Sidebar**

```typescript
// Update MainPage.tsx imports and replace SidebarPlaceholder
import { Sidebar } from './components/Sidebar'

// Replace SidebarPlaceholder with <Sidebar />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/main/components/Sidebar.tsx frontend/src/pages/main/MainPage.tsx
git commit -m "feat: extract Sidebar component from MainApp"
```

---

### Task 3.3: Extract DocumentPanel Component

**Files:**
- Create: `frontend/src/pages/main/components/DocumentPanel.tsx`

- [ ] **Step 1: Create DocumentPanel.tsx**

```typescript
// frontend/src/pages/main/components/DocumentPanel.tsx
import { useEffect, useCallback } from 'react'
import { FileText, FileStack, BookOpen } from 'lucide-react'
import { useCollectionStore } from '../../../stores/collectionStore'
import { useDocumentStore } from '../../../stores/documentStore'
import { useUIStore } from '../../../stores/uiStore'
import { DocumentUpload } from '../../../components/DocumentManager/DocumentUpload'
import { DocumentList } from '../../../components/DocumentManager/DocumentList'
import { DocumentPreview } from '../../../components/DocumentManager/DocumentPreview'
import { PaperList } from '../../../components/PaperManager/PaperList'
import { PaperDetail } from '../../../components/PaperManager/PaperDetail'
import { Pagination } from '../../../components/common/Pagination'
import { apiClient } from '../../../services/api'
import type { Document, ProcessStatus } from '../../../types/document'

const PAGE_SIZE = 20

export function DocumentPanel() {
  const selectedCollectionId = useCollectionStore((s) => s.selectedId)
  const middlePanelTab = useUIStore((s) => s.middlePanelTab)
  const selectedPaperId = useUIStore((s) => s.selectedPaperId)
  const previewDocument = useUIStore((s) => s.previewDocument)
  
  const {
    documents,
    total,
    currentPage,
    isLoading,
    watchingDocIds,
    setDocuments,
    setTotal,
    setCurrentPage,
    setIsLoading,
    addWatchingDocIds,
    removeWatchingDocId,
    updateDocumentStatus,
  } = useDocumentStore()

  const setMiddlePanelTab = useUIStore((s) => s.setMiddlePanelTab)
  const setSelectedPaperId = useUIStore((s) => s.setSelectedPaperId)
  const setPreviewDocument = useUIStore((s) => s.setPreviewDocument)

  // Fetch documents
  const fetchDocuments = useCallback(async (page: number = 1) => {
    if (!selectedCollectionId) return null
    try {
      const skip = (page - 1) * PAGE_SIZE
      const response = await apiClient.get(
        `/api/collections/${selectedCollectionId}/documents`,
        { params: { skip, limit: PAGE_SIZE } }
      )
      setDocuments(response.data.documents)
      setTotal(response.data.total)
      setCurrentPage(page)
      addWatchingDocIds(
        response.data.documents
          .filter((doc: Document) => doc.status === 'pending' || doc.status === 'processing')
          .map((doc: Document) => doc.id)
      )
      return response.data.documents
    } catch (error) {
      console.error('Failed to fetch documents:', error)
      return null
    }
  }, [selectedCollectionId, setDocuments, setTotal, setCurrentPage, addWatchingDocIds])

  // Load documents when collection changes
  useEffect(() => {
    if (!selectedCollectionId) {
      setDocuments([])
      setTotal(0)
      setCurrentPage(1)
      return
    }
    
    setIsLoading(true)
    fetchDocuments(1).finally(() => setIsLoading(false))
  }, [selectedCollectionId, fetchDocuments, setDocuments, setTotal, setCurrentPage, setIsLoading])

  // Handle upload complete
  const handleUploadComplete = async (newDocIds?: string[]) => {
    const data = await fetchDocuments(1)
    if (data && newDocIds && newDocIds.length > 0) {
      addWatchingDocIds(newDocIds)
    }
  }

  // Handle status update from SSE
  const handleStatusUpdate = (docId: string, status: {
    status: ProcessStatus
    progress?: number
    chunk_count?: number
    error?: string
  }) => {
    updateDocumentStatus(docId, status)
    if (status.status === 'completed' || status.status === 'failed') {
      fetchDocuments(1)
      removeWatchingDocId(docId)
    }
  }

  // Handle delete
  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedCollectionId) return
    if (!confirm('确定要删除这个文档吗？')) return

    try {
      const response = await apiClient.delete(
        `/api/collections/${selectedCollectionId}/documents/${documentId}`
      )
      if (response.status === 200) {
        setDocuments(documents.filter(d => d.id !== documentId))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  if (!selectedCollectionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">选择知识库查看内容</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Tab switcher */}
      <div className="border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex">
          <button
            onClick={() => setMiddlePanelTab('documents')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              middlePanelTab === 'documents'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <FileStack className="w-4 h-4" />
            文档
          </button>
          <button
            onClick={() => setMiddlePanelTab('papers')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              middlePanelTab === 'papers'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            论文
          </button>
        </div>
      </div>

      {/* Content area */}
      {middlePanelTab === 'documents' ? (
        <>
          <div className="p-4">
            <DocumentUpload
              collectionId={selectedCollectionId}
              onUploadComplete={handleUploadComplete}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {isLoading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">加载中...</div>
            ) : (
              <>
                <DocumentList
                  documents={documents}
                  collectionId={selectedCollectionId}
                  onDelete={handleDeleteDocument}
                  onPreview={(doc) => setPreviewDocument({ id: doc.id, title: doc.title, file_type: doc.file_type })}
                  onRefresh={() => fetchDocuments(currentPage)}
                  onStatusUpdate={handleStatusUpdate}
                  watchingDocIds={watchingDocIds}
                />
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(total / PAGE_SIZE)}
                  total={total}
                  onPageChange={(page) => {
                    setIsLoading(true)
                    fetchDocuments(page).finally(() => setIsLoading(false))
                  }}
                />
              </>
            )}
          </div>
        </>
      ) : selectedPaperId ? (
        <div className="flex-1 overflow-y-auto p-4">
          <PaperDetail
            paperId={selectedPaperId}
            onClose={() => setSelectedPaperId(null)}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <PaperList
            collectionId={selectedCollectionId}
            onSelectPaper={setSelectedPaperId}
          />
        </div>
      )}

      {/* Document preview modal */}
      {previewDocument && selectedCollectionId && (
        <DocumentPreview
          collectionId={selectedCollectionId}
          documentId={previewDocument.id}
          documentTitle={previewDocument.title}
          fileType={previewDocument.file_type}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Update MainPage to use DocumentPanel**

```typescript
// Update MainPage.tsx imports and replace DocumentPanelPlaceholder
import { DocumentPanel } from './components/DocumentPanel'

// Replace DocumentPanelPlaceholder with <DocumentPanel />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/main/components/DocumentPanel.tsx frontend/src/pages/main/MainPage.tsx
git commit -m "feat: extract DocumentPanel component from MainApp"
```

---

### Task 3.4: Extract ChatPanel and SessionSidebar

**Files:**
- Create: `frontend/src/pages/main/components/ChatPanel.tsx`
- Create: `frontend/src/pages/main/components/SessionSidebar.tsx`

- [ ] **Step 1: Create SessionSidebar.tsx**

```typescript
// frontend/src/pages/main/components/SessionSidebar.tsx
import { useEffect, useCallback } from 'react'
import { Plus, Trash2, MessageSquare, MessageCircle, Search, X } from 'lucide-react'
import { ResizableSidebar } from '../../../components/Layout/ResizableSidebar'
import { useCollectionStore } from '../../../stores/collectionStore'
import { useSessionStore } from '../../../stores/sessionStore'
import { sessionService } from '../../../services/sessionService'

export function SessionSidebar() {
  const selectedCollectionId = useCollectionStore((s) => s.selectedId)
  const {
    sessions,
    currentSession,
    searchQuery,
    setSessions,
    addSession,
    removeSession,
    setCurrentSession,
    setMessages,
    updateCurrentSession,
    setSearchQuery,
  } = useSessionStore()

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    if (!selectedCollectionId) return
    try {
      const data = await sessionService.list(selectedCollectionId)
      setSessions(data.sessions)
      if (!currentSession && data.sessions.length > 0) {
        selectSession(data.sessions[0])
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }, [selectedCollectionId, currentSession, setSessions])

  // Select session
  const selectSession = async (session: typeof currentSession) => {
    if (!session) return
    setCurrentSession(session)
    try {
      const fullSession = await sessionService.get(session.id)
      setMessages(fullSession.messages || [])
    } catch (error) {
      console.error('Failed to load session messages:', error)
      setMessages([])
    }
  }

  // Create new session
  const createNewSession = async () => {
    if (!selectedCollectionId) return
    try {
      const newSession = await sessionService.create(selectedCollectionId, '新对话')
      addSession(newSession)
      setCurrentSession(newSession)
      setMessages([])
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Delete session
  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此对话？')) return

    try {
      await sessionService.delete(sessionId)
      removeSession(sessionId)
      if (currentSession?.id === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId)
        if (remaining.length > 0) {
          selectSession(remaining[0])
        } else {
          setCurrentSession(null)
          setMessages([])
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  // Load sessions when collection changes
  useEffect(() => {
    if (!selectedCollectionId) {
      setSessions([])
      setCurrentSession(null)
      setMessages([])
      setSearchQuery('')
      return
    }
    fetchSessions()
  }, [selectedCollectionId, fetchSessions, setSessions, setCurrentSession, setMessages, setSearchQuery])

  const filteredSessions = sessions.filter(s => 
    s.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <ResizableSidebar
      defaultWidth={256}
      minWidth={200}
      maxWidth={400}
      side="right"
      title="对话"
    >
      <div className="p-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">对话</span>
          <button
            onClick={createNewSession}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新对话
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-7 pr-6 py-1 text-xs border dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs mb-2">暂无对话</p>
            <button
              onClick={createNewSession}
              className="text-blue-500 dark:text-blue-400 text-xs hover:underline"
            >
              开始新对话
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p className="text-xs">无匹配对话</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => selectSession(session)}
                className={`group p-2.5 rounded-lg cursor-pointer transition-all ${
                  currentSession?.id === session.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-600'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                      {session.title || '新对话'}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {session.message_count} 条消息
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ResizableSidebar>
  )
}
```

- [ ] **Step 2: Create ChatPanel.tsx**

```typescript
// frontend/src/pages/main/components/ChatPanel.tsx
import { MessageSquare } from 'lucide-react'
import { useCollectionStore } from '../../../stores/collectionStore'
import { useSessionStore } from '../../../stores/sessionStore'
import { ChatWindow } from '../../../components/QAInterface/ChatWindow'
import { SessionSidebar } from './SessionSidebar'
import { sessionService } from '../../../services/sessionService'

export function ChatPanel() {
  const selectedCollectionId = useCollectionStore((s) => s.selectedId)
  const {
    currentSession,
    messages,
    setMessages,
    updateCurrentSession,
  } = useSessionStore()

  // Handle query complete - refresh session
  const handleQueryComplete = async () => {
    if (!currentSession) return
    try {
      const fullSession = await sessionService.get(currentSession.id)
      setMessages(fullSession.messages || [])
      updateCurrentSession({
        title: fullSession.title,
        message_count: fullSession.message_count,
      })
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }

  // Handle title update
  const handleUpdateTitle = async (title: string) => {
    if (!currentSession) return
    try {
      await sessionService.update(currentSession.id, { title })
      updateCurrentSession({ title })
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }

  // Handle web search toggle
  const handleToggleWebSearch = async (enabled: boolean) => {
    if (!currentSession) return
    try {
      await sessionService.update(currentSession.id, { web_search_enabled: enabled })
      updateCurrentSession({ web_search_enabled: enabled })
    } catch (error) {
      console.error('Failed to toggle web search:', error)
    }
  }

  return (
    <main className="flex-1 flex">
      {/* Chat window */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        {selectedCollectionId ? (
          <ChatWindow
            collectionId={selectedCollectionId}
            sessionId={currentSession?.id || null}
            sessionMessages={messages}
            sessionTitle={currentSession?.title || null}
            webSearchEnabled={currentSession?.web_search_enabled || false}
            onQueryComplete={handleQueryComplete}
            onUpdateTitle={handleUpdateTitle}
            onToggleWebSearch={handleToggleWebSearch}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">开始对话</p>
              <p className="text-sm mt-1">选择左侧知识库后即可提问</p>
            </div>
          </div>
        )}
      </div>

      {/* Session sidebar */}
      {selectedCollectionId && <SessionSidebar />}
    </main>
  )
}
```

- [ ] **Step 3: Update MainPage to use ChatPanel**

```typescript
// Update MainPage.tsx imports and replace ChatPanelPlaceholder
import { ChatPanel } from './components/ChatPanel'

// Replace ChatPanelPlaceholder with <ChatPanel />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/main/components/ChatPanel.tsx frontend/src/pages/main/components/SessionSidebar.tsx frontend/src/pages/main/MainPage.tsx
git commit -m "feat: extract ChatPanel and SessionSidebar components"
```

---

### Task 3.5: Remove Old MainApp Code

**Files:**
- Modify: `frontend/src/App.tsx` (delete old MainApp function)

- [ ] **Step 1: Delete old App.tsx content**

The old `frontend/src/App.tsx` should be removed or kept only as a backup. The new entry point is `frontend/src/app/App.tsx`.

```bash
# Backup old App.tsx and remove it
mv frontend/src/App.tsx frontend/src/App.tsx.backup
```

- [ ] **Step 2: Verify app still builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify app runs in dev mode**

Run: `cd frontend && npm run dev`
Expected: App starts without errors

- [ ] **Step 4: Remove backup file**

```bash
rm frontend/src/App.tsx.backup
```

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/
git commit -m "refactor: remove old MainApp code, complete frontend refactor"
```

---

### Task 3.6: Add Component Tests

**Files:**
- Create: `frontend/src/__tests__/pages/main/MainPage.test.tsx`

- [ ] **Step 1: Create MainPage.test.tsx**

```typescript
// frontend/src/__tests__/pages/main/MainPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
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
  it('should render all panels', () => {
    render(<MainPage />, { wrapper: createWrapper() })
    
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('document-panel')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('should reset stores when collection is null', () => {
    useCollectionStore.setState({ selectedId: null })
    
    render(<MainPage />, { wrapper: createWrapper() })
    
    // When selectedId is null, stores should be reset
    expect(useCollectionStore.getState().selectedId).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/pages/
git commit -m "test: add MainPage component tests"
```

---

## Summary

**Files Created:**
- `frontend/src/app/App.tsx` - New app entry with Router
- `frontend/src/app/routes.tsx` - Route definitions
- `frontend/src/app/AppLayout.tsx` - Shared layout
- `frontend/src/app/AuthGuard.tsx` - Auth protection
- `frontend/src/stores/*.ts` - Zustand stores (4 files)
- `frontend/src/pages/main/MainPage.tsx` - Main page
- `frontend/src/pages/main/components/*.tsx` - Page components (3 files)
- `frontend/src/pages/*/` - Other page directories
- `frontend/src/__tests__/*.ts` - Test files

**Files Modified:**
- `frontend/package.json` - Added dependencies and scripts
- `frontend/src/main.tsx` - Updated entry point
- `frontend/src/components/Layout/Header.tsx` - Router navigation

**Files Removed:**
- `frontend/src/App.tsx` - Old monolithic component (backed up then deleted)

**Expected Outcome:**
- `App.tsx` reduced from ~590 lines to ~30 lines
- `MainApp` component split into 4 focused components
- All pages accessible via URL
- Store tests passing
- Clean separation of concerns
