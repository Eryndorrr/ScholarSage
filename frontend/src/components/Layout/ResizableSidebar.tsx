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
      <aside className={`w-12 h-full bg-white dark:bg-gray-800 border-${side === 'left' ? 'r' : 'l'} dark:border-gray-700 flex flex-col min-h-0 overflow-hidden ${className}`}>
        {title && (
          <div className="p-2 border-b dark:border-gray-700 flex items-center justify-center">
            <button
              onClick={toggleCollapse}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="展开"
            >
              {side === 'left' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <button
            onClick={toggleCollapse}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="展开"
          >
            {side === 'left' ? <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" /> : <ChevronLeft className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className={`relative bg-white dark:bg-gray-800 border-${side === 'left' ? 'r' : 'l'} dark:border-gray-700 flex flex-col min-h-0 overflow-hidden ${className}`}
    >
      {children}

      {/* 折叠按钮 */}
      {collapsible && (
        <button
          onClick={toggleCollapse}
          className={`absolute top-1/2 -translate-y-1/2 z-10 p-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
            side === 'left' ? '-right-3' : '-left-3'
          }`}
          title="收起"
        >
          {side === 'left' ? <ChevronLeft className="w-3 h-3 text-gray-400 dark:text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />}
        </button>
      )}

      {/* 调整宽度手柄 */}
      <div
        className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors z-20 ${
          side === 'left' ? '-right-0.5' : '-left-0.5'
        } ${isResizing ? 'bg-blue-400 dark:bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={handleMouseDown}
      />
    </aside>
  )
}
