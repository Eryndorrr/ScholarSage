import { apiClient } from './api'
import type {
  AuthResponse, LoginRequest, RegisterRequest, User, AdminUser,
  ChangePasswordRequest, UpdateProfileRequest, AdminResetPasswordRequest
} from '../types/auth'

const TOKEN_KEY = 'rag_access_token'

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/api/auth/login', data)
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    return res.data
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/api/auth/register', data)
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    return res.data
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<User>('/api/auth/me')
    return res.data
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY)
  },

  // Admin methods
  async listUsers(): Promise<{ users: AdminUser[]; total: number }> {
    const res = await apiClient.get('/api/admin/users')
    return res.data
  },

  async updateUser(userId: string, data: { role?: 'admin' | 'user'; is_active?: boolean }): Promise<AdminUser> {
    const res = await apiClient.put(`/api/admin/users/${userId}`, data)
    return res.data
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/api/admin/users/${userId}`)
  },

  async resetUserPassword(userId: string, data: AdminResetPasswordRequest): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.put(`/api/admin/users/${userId}/reset-password`, data)
    return res.data
  },

  // User profile methods
  async changePassword(data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.put('/api/auth/password', data)
    return res.data
  },

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const res = await apiClient.put<User>('/api/auth/profile', data)
    return res.data
  },
}
