// frontend/src/pages/evaluation/EvaluationPage.tsx
import { useNavigate } from 'react-router-dom'
import { EvaluationPage as EvaluationPageComponent } from '../../components/Evaluation/EvaluationPage'

export function EvaluationPage() {
  const navigate = useNavigate()

  return <EvaluationPageComponent onBack={() => navigate('/')} />
}
