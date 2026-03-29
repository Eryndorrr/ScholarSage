import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold p-4">RAG知识库系统</h1>
      </div>
    </QueryClientProvider>
  )
}

export default App