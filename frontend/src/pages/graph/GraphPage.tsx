// frontend/src/pages/graph/GraphPage.tsx
import { useNavigate } from 'react-router-dom'
import { KnowledgeGraphPage as GraphPageComponent } from '../../components/KnowledgeGraph/KnowledgeGraphPage'

export function GraphPage() {
  const navigate = useNavigate()

  return <GraphPageComponent onBack={() => navigate('/')} />
}
