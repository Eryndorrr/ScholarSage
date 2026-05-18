# 前端重构设计文档

## 概述

对 ScholarSage 前端进行全面重构，解决以下问题：
- `App.tsx` 中 `MainApp` 组件约 520 行，管理 15+ 状态变量，难以维护
- 状态管理混乱：React Query 和手动 useState 混用
- 页面切换通过状态控制，URL 不可分享
- 缺少前端测试

## 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 状态管理 | Zustand + React Query | 轻量级，学习成本低，服务端数据用 RQ，客户端状态用 Zustand |
| 路由 | React Router | URL 可分享，浏览器前进后退可用 |
| 组件拆分 | 按页面/路由 | 每个路由一个页面组件，页面内部再按需拆分 |
| 测试框架 | Vitest + React Testing Library | Vite 原生支持，配置简单，速度快 |

## 一、目录结构

```
frontend/src/
├── app/                          # 应用入口
│   ├── App.tsx                   # Router + Provider 配置
│   ├── main.tsx                  # 入口文件
│   ├── routes.tsx                # 路由定义
│   ├── AppLayout.tsx             # 共享布局
│   └── AuthGuard.tsx             # 认证守卫
│
├── pages/                        # 页面组件（按路由）
│   ├── main/
│   │   ├── MainPage.tsx          # 主页面（知识库+文档+对话）
│   │   ├── components/           # 主页面专用组件
│   │   │   ├── Sidebar.tsx       # 左侧知识库栏
│   │   │   ├── DocumentPanel.tsx # 中间文档面板
│   │   │   ├── ChatPanel.tsx     # 右侧对话面板
│   │   │   └── SessionSidebar.tsx# 对话列表侧栏
│   │   └── hooks/                # 主页面专用 hooks
│   │       └── useMainPage.ts
│   │
│   ├── evaluation/
│   │   └── EvaluationPage.tsx    # 效果评估页
│   ├── graph/
│   │   └── GraphPage.tsx         # 知识图谱页
│   ├── dashboard/
│   │   └── DashboardPage.tsx     # 健康监控页
│   ├── admin/
│   │   └── AdminPage.tsx         # 管理页
│   └── auth/
│       └── AuthPage.tsx          # 登录页
│
├── stores/                       # Zustand stores
│   ├── index.ts                  # 统一导出
│   ├── collectionStore.ts        # 当前选中的知识库
│   ├── documentStore.ts          # 文档列表 + 分页
│   ├── sessionStore.ts           # 会话列表 + 当前会话
│   └── uiStore.ts                # UI 状态（弹窗、标签页等）
│
├── components/                   # 共享组件（跨页面）
│   ├── common/                   # 通用 UI 组件
│   ├── layout/                   # 布局组件
│   └── ...
│
├── hooks/                        # 共享 hooks
│   ├── useCollections.ts         # React Query（已有）
│   ├── useQuery.ts               # 流式查询（已有）
│   └── ...
│
├── services/                     # API 服务（保持不变）
├── contexts/                     # Context（Auth/Theme 保持）
├── types/                        # 类型定义（保持不变）
└── __tests__/                    # 测试目录
    ├── pages/
    ├── stores/
    └── components/
```

## 二、Zustand Store 设计

### collectionStore.ts

```typescript
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

### documentStore.ts

```typescript
import { create } from 'zustand'
import type { Document, ProcessStatus } from '../types/document'

interface DocumentState {
  documents: Document[]
  total: number
  currentPage: number
  isLoading: boolean
  watchingDocIds: string[]
  
  // Actions
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

const PAGE_SIZE = 20

export const useDocumentStore = create<DocumentState>((set, get) => ({
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

### sessionStore.ts

```typescript
import { create } from 'zustand'
import type { Session, SessionMessage } from '../types/session'

interface SessionState {
  sessions: Session[]
  currentSession: Session | null
  messages: SessionMessage[]
  searchQuery: string
  
  // Actions
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

### uiStore.ts

```typescript
import { create } from 'zustand'

type MiddlePanelTab = 'documents' | 'papers'

interface UIState {
  middlePanelTab: MiddlePanelTab
  selectedPaperId: string | null
  previewDocument: { id: string; title: string; file_type: string } | null
  showSettings: boolean
  
  // Actions
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

## 三、路由设计

### routes.tsx

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom'
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

### URL 映射

| 路由 | 页面 |
|------|------|
| `/login` | 登录页 |
| `/` | 主页面（知识库+对话） |
| `/evaluation` | 效果评估 |
| `/graph` | 知识图谱 |
| `/dashboard` | 健康监控 |
| `/admin` | 管理后台 |

## 四、MainPage 拆分设计

### MainPage.tsx

```typescript
import { useEffect } from 'react'
import { useCollectionStore } from '../../stores/collectionStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useSessionStore } from '../../stores/sessionStore'
import { ResizableSidebar } from '../../components/layout/ResizableSidebar'
import { Sidebar } from './components/Sidebar'
import { DocumentPanel } from './components/DocumentPanel'
import { ChatPanel } from './components/ChatPanel'

export function MainPage() {
  const selectedId = useCollectionStore(s => s.selectedId)
  const resetDocs = useDocumentStore(s => s.reset)
  const resetSessions = useSessionStore(s => s.reset)

  // 切换知识库时重置子状态
  useEffect(() => {
    if (!selectedId) {
      resetDocs()
      resetSessions()
    }
  }, [selectedId, resetDocs, resetSessions])

  return (
    <div className="flex-1 flex overflow-hidden">
      <ResizableSidebar defaultWidth={256} minWidth={200} maxWidth={400} side="left" title="知识库">
        <Sidebar />
      </ResizableSidebar>

      <ResizableSidebar defaultWidth={400} minWidth={320} maxWidth={700} side="left" title="文档">
        <DocumentPanel />
      </ResizableSidebar>

      <ChatPanel />
    </div>
  )
}
```

### 组件职责

| 组件 | 职责 | 数据来源 |
|------|------|----------|
| `Sidebar` | 知识库列表 + 选中逻辑 | `useCollectionStore` + `useCollections` hook |
| `DocumentPanel` | 文档上传/列表/分页 + 论文标签切换 | `useDocumentStore` + `useUIStore` |
| `ChatPanel` | 对话窗口 + 会话列表入口 | `useSessionStore` + `useQuery` hook |
| `SessionSidebar` | 会话列表 + 搜索 + 创建/删除 | `useSessionStore` |

## 五、测试策略

### 测试覆盖

| 层级 | 测试重点 | 工具 |
|------|----------|------|
| Store | 状态变更、action 逻辑、reset 行为 | Vitest |
| 页面组件 | 渲染正确性、子组件组合、路由效果 | RTL + Vitest |
| 子组件 | 用户交互（点击、输入）、事件触发 | RTL |
| Hooks | API 调用、流式查询、错误处理 | MSW + Vitest |

### 测试命令

```bash
npm test                  # 运行所有测试
npm test -- --watch       # 监听模式
npm test -- --coverage    # 覆盖率报告
```

## 六、实施步骤

### 阶段 1：基础设施层（约 1-2 天）

| 步骤 | 任务 | 验证方式 |
|------|------|----------|
| 1.1 | 安装依赖：`zustand react-router-dom vitest @testing-library/react @testing-library/user-event` | `npm install` 成功 |
| 1.2 | 配置 Vitest | `npm test` 运行无报错 |
| 1.3 | 创建目录结构 | 目录存在 |
| 1.4 | 创建 4 个 Zustand Store 文件 | Store 可导入使用 |
| 1.5 | 为每个 Store 编写测试 | 测试通过 |

### 阶段 2：路由层（约 1 天）

| 步骤 | 任务 | 验证方式 |
|------|------|----------|
| 2.1 | 创建 `app/routes.tsx` 定义路由 | 路由可访问 |
| 2.2 | 创建 `AppLayout` + `AuthGuard` | 布局渲染正确 |
| 2.3 | 迁移现有页面组件到 `pages/` 目录 | 页面功能正常 |
| 2.4 | 修改 `App.tsx` 使用 RouterProvider | 所有页面可访问 |
| 2.5 | 删除旧的 `MainApp` 中的页面切换逻辑 | 无冗余代码 |

### 阶段 3：MainPage 拆分（约 2-3 天）

| 步骤 | 任务 | 验证方式 |
|------|------|----------|
| 3.1 | 创建 `MainPage.tsx` 骨架 | 页面渲染 |
| 3.2 | 抽取 `Sidebar` 组件 | 知识库列表正常 |
| 3.3 | 抽取 `DocumentPanel` 组件 | 文档上传/列表正常 |
| 3.4 | 抽取 `ChatPanel` + `SessionSidebar` | 对话功能正常 |
| 3.5 | 迁移状态到 Store，删除 MainApp 中的 useState | 状态管理正确 |
| 3.6 | 为每个组件编写测试 | 测试通过 |
| 3.7 | 删除旧的 `MainApp` 函数 | 无冗余代码 |

## 风险控制

- 每步完成后提交 Git，便于回滚
- 阶段 2 完成后可暂停，现有功能不受影响
- 阶段 3 逐步迁移，每个组件独立验证

## 预期成果

- `App.tsx` 从约 590 行降至约 50 行
- `MainApp` 组件拆分为 4 个独立组件
- 状态管理统一：Zustand 管理客户端状态，React Query 管理服务端数据
- 所有页面可通过 URL 访问
- 测试覆盖 Store 和关键组件
