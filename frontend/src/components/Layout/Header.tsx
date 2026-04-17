import { BookOpen, BarChart3, Network, Activity, LogOut, User, Shield, Settings, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface HeaderProps {
  onEvaluationClick?: () => void
  onGraphClick?: () => void
  onDashboardClick?: () => void
  onAdminClick?: () => void
  onSettingsClick?: () => void
}

export function Header({ onEvaluationClick, onGraphClick, onDashboardClick, onAdminClick, onSettingsClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="bg-white border-b px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-800">RAG 知识库</h1>
        </div>

        <div className="flex items-center gap-2">
          {onDashboardClick && (
            <button
              onClick={onDashboardClick}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <Activity className="w-5 h-5" />
              <span className="text-sm font-medium">健康度</span>
            </button>
          )}
          {onGraphClick && (
            <button
              onClick={onGraphClick}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <Network className="w-5 h-5" />
              <span className="text-sm font-medium">知识图谱</span>
            </button>
          )}

          {onEvaluationClick && (
            <button
              onClick={onEvaluationClick}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-medium">效果评估</span>
            </button>
          )}

          {/* 管理员按钮 */}
          {user?.role === 'admin' && onAdminClick && (
            <button
              onClick={onAdminClick}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">用户管理</span>
            </button>
          )}

          {/* 用户信息 + 下拉菜单 */}
          {user && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
                      管理员
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        setDropdownOpen(false)
                        onSettingsClick?.()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="w-4 h-4" />
                      个人设置
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setDropdownOpen(false)
                        logout()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
