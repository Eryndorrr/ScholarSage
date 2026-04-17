import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '../types/auth'
import { authService } from '../services/authService'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  useEffect(() => {
    // 启动时检查 token 是否有效
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        try {
          const me = await authService.getMe()
          setUser(me)
        } catch {
          logout()
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [logout])

  const login = async (username: string, password: string) => {
    const res = await authService.login({ username, password })
    setUser(res.user)
  }

  const register = async (username: string, email: string, password: string) => {
    const res = await authService.register({ username, email, password })
    setUser(res.user)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
