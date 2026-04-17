export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface AdminUser {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  last_login_at: string | null
  collection_count: number
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

export interface UpdateProfileRequest {
  email?: string
}

export interface AdminResetPasswordRequest {
  new_password: string
}
