/**
 * 认证相关的工具函数
 */

/**
 * 获取认证请求头
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('rag_access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * 带认证的 fetch 封装
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
