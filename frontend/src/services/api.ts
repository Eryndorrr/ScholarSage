import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：添加 Authorization header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('rag_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 时清除 token
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rag_access_token')
      // 如果不在登录页，刷新页面触发重新登录
      if (!window.location.hash.includes('login')) {
        window.location.reload()
      }
    }
    return Promise.reject(error)
  }
)
