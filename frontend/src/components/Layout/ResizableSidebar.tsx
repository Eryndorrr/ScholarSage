import { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ResizableSidebarProps {
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  side?: 'left' | 'right'
  className?: string
  collapsible?: boolean
  title?: string
}

export function ResizableSidebar({
  children,
  defaultWidth = 280,
  minWidth = 200,
  maxWidth = 500,
  side = 'left',
  className = '',
  collapsible = true,
  title,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [width, side, minWidth, maxWidth])

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  if (isCollapsed) {
    return (
      <aside className={`w-12 bg-white border-${side === 'left' ? 'r' : 'l'} flex flex-col ${className}`}>
        {title && (
          <div className="p-2 border-b flex items-center justify-center">
            <button
              onClick={toggleCollapse}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="展开"
            >
              {side === 'left' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={toggleCollapse}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="展开"
          >
            {side === 'left' ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronLeft className="w-5 h-5 text-gray-400" />}
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className={`relative bg-white border-${side === 'left' ? 'r' : 'l'} flex flex-col ${className}`}
    >
      {children}

      {/* 折叠按钮 */}
      {collapsible && (
        <button
          onClick={toggleCollapse}
          className={`absolute top-1/2 -translate-y-1/2 z-10 p-1 bg-white border rounded-md shadow-sm hover:bg-gray-50 transition-colors ${
            side === 'left' ? '-right-3' : '-left-3'
          }`}
          title="收起"
        >
          {side === 'left' ? <ChevronLeft className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
        </button>
      )}

      {/* 调整宽度手柄 */}
      <div
        className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-200 transition-colors z-20 ${
          side === 'left' ? '-right-0.5' : '-left-0.5'
        } ${isResizing ? 'bg-blue-400' : 'bg-transparent'}`}
        onMouseDown={handleMouseDown}
      />
    </aside>
  )
}
