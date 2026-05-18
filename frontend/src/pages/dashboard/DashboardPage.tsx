// frontend/src/pages/dashboard/DashboardPage.tsx
import { useNavigate } from 'react-router-dom'
import { HealthDashboard as DashboardComponent } from '../../components/Dashboard/HealthDashboard'

export function DashboardPage() {
  const navigate = useNavigate()

  return <DashboardComponent onBack={() => navigate('/')} />
}
