import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/Layout/MainLayout'
import { CollectionList } from './components/CollectionManager/CollectionList'
import { ChatWindow } from './components/QAInterface/ChatWindow'
import { useState } from 'react'

const queryClient = new QueryClient()

function App() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <div className="flex gap-6">
          {/* 左侧：知识库列表 */}
          <div className="w-80 flex-shrink-0">
            <CollectionList
              onSelectCollection={setSelectedCollection}
            />
          </div>

          {/* 右侧：问答界面 */}
          <div className="flex-1">
            <ChatWindow collectionId={selectedCollection} />
          </div>
        </div>
      </MainLayout>
    </QueryClientProvider>
  )
}

export default App