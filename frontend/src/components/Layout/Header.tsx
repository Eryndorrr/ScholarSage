import { FileText, MessageSquare, BookOpen } from 'lucide-react'

export function Header() {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            RAG知识库系统
          </h1>
          <nav className="flex gap-6 text-sm">
            <a href="#" className="flex items-center gap-1 hover:underline">
              <FileText className="w-4 h-4" />
              知识库
            </a>
            <a href="#" className="flex items-center gap-1 hover:underline">
              <MessageSquare className="w-4 h-4" />
              问答
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}