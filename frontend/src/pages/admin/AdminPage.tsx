// frontend/src/pages/admin/AdminPage.tsx
import { useNavigate } from 'react-router-dom'
import { AdminPage as AdminPageComponent } from '../../components/Admin/AdminPage'

export function AdminPage() {
  const navigate = useNavigate()

  return <AdminPageComponent onBack={() => navigate('/')} />
}
