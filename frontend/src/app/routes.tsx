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
