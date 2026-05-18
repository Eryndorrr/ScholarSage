// frontend/src/app/AppLayout.tsx
import { Outlet } from 'react-router-dom'
import { Header } from '../components/Layout/Header'

export function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-1 overflow-hidden min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
