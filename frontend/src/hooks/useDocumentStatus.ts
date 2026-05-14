import { useEffect, useState, useRef } from 'react'
import type { ProcessStatus } from '../types/document'

interface DocStatus {
  status: ProcessStatus
  progress?: number
  stage?: string
  chunk_count?: number
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useDocumentStatus(
  docId: string | null,
  collectionId: string | null,
  onStatusChange?: (status: DocStatus) => void
) {
  const [status, setStatus] = useState<DocStatus | null>(null)

  useEffect(() => {
    if (!docId || !collectionId) {
      setStatus(null)
      return
    }

    const token = localStorage.getItem('rag_access_token')
    if (!token) {
      console.warn('No auth token for SSE connection')
      return
    }

    const url = `${API_BASE_URL}/api/collections/${collectionId}/documents/${docId}/status/stream`
    const controller = new AbortController()

    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        const readChunk = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) return

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  setStatus(data)
                  onStatusChange?.(data)

                  if (data.status === 'completed' || data.status === 'failed') {
                    controller.abort()
                    return
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', line)
                }
              }
            }

            return readChunk()
          })
        }

        return readChunk()
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('SSE error:', err)
        }
      })

    return () => {
      controller.abort()
    }
  }, [docId, collectionId, onStatusChange])

  return status
}
