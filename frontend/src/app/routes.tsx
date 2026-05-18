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
