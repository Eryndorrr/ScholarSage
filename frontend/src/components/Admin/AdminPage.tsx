import { useState, useEffect } from 'react'
import { authService } from '../../services/authService'
import { useAuth } from '../../contexts/AuthContext'
import type { AdminUser } from '../../types/auth'
import { ArrowLeft, Shield, UserX, UserCheck, Trash2, Users, KeyRound, X } from 'lucide-react'

interface AdminPageProps {
  onBack: () => void
}

export function AdminPage({ onBack }: AdminPageProps) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await authService.listUsers()
      setUsers(data.users)
    } catch {
      setError('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const updated = await authService.updateUser(user.id, { is_active: !user.is_active })
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '操作失败'
      alert(msg)
    }
  }

  const handleToggleRole = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`确定将 ${user.username} 的角色改为 ${newRole === 'admin' ? '管理员' : '普通用户'}？`)) return

    try {
      const updated = await authService.updateUser(user.id, { role: newRole })
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '操作失败'
      alert(msg)
    }
  }

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`确定删除用户 ${user.username}？此操作不可恢复！`)) return

    try {
      await authService.deleteUser(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '删除失败'
      alert(msg)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return
    if (newPassword.length < 6) {
      setResetError('密码至少需要 6 个字符')
      return
    }

    setResetLoading(true)
    setResetError('')
    try {
      await authService.resetUserPassword(resetPasswordUser.id, { new_password: newPassword })
      setResetSuccess(`用户 ${resetPasswordUser.username} 的密码已重置`)
      setNewPassword('')
      setTimeout(() => {
        setResetPasswordUser(null)
        setResetSuccess('')
      }, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '重置密码失败'
      setResetError(msg)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            <h1 className="text-lg font-bold text-gray-800">用户管理</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">总用户</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{users.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-medium">管理员</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{users.filter(u => u.role === 'admin').length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <UserCheck className="w-4 h-4" />
              <span className="text-xs font-medium">活跃用户</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{users.filter(u => u.is_active).length}</p>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">用户名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">邮箱</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">角色</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">知识库</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">注册时间</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-semibold text-blue-600">
                            {user.username[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                          {user.username}
                          {user.id === currentUser?.id && (
                            <span className="ml-1 text-xs text-gray-400">(你)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded">
                          管理员
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded">
                          用户
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                          活跃
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded">
                          禁用
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.collection_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle role */}
                        <button
                          onClick={() => handleToggleRole(user)}
                          disabled={user.id === currentUser?.id}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title={user.role === 'admin' ? '降级为用户' : '升级为管理员'}
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        {/* Reset password */}
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="重置密码"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={user.id === currentUser?.id}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title={user.is_active ? '禁用用户' : '启用用户'}
                        >
                          {user.is_active ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={user.id === currentUser?.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="删除用户"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 重置密码弹窗 */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">重置密码</h2>
              <button
                onClick={() => {
                  setResetPasswordUser(null)
                  setNewPassword('')
                  setResetError('')
                  setResetSuccess('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                为用户 <span className="font-semibold">{resetPasswordUser.username}</span> 设置新密码
              </p>

              {resetError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">
                  {resetSuccess}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="至少 6 个字符"
                  minLength={6}
                />
              </div>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || !newPassword}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? '处理中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
