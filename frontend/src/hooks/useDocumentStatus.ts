import { useEffect, useRef, useState } from 'react'
import type { ProcessStatus } from '../types/document'

interface DocStatus {
  status: ProcessStatus
  progress?: number
  stage?: string
  chunk_count?: number
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export function useDocumentStatus(
  docId: string | null,
  collectionId: string | null,
  onStatusChange?: (status: DocStatus) => void
) {
  const [status, setStatus] = useState<DocStatus | null>(null)
  const onStatusChangeRef = useRef(onStatusChange)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    if (!docId || !collectionId) {
      return
    }

    const token = localStorage.getItem('rag_access_token')
    if (!token) {
      console.warn('No auth token for SSE connection')
      return
    }

    const statusUrl = `${API_BASE_URL}/api/collections/${collectionId}/documents/${docId}/status`
    const streamUrl = `${statusUrl}/stream`
    const controller = new AbortController()
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let stopped = false
    let reachedTerminalState = false

    const handleStatus = (data: DocStatus) => {
      setStatus(data)
      onStatusChangeRef.current?.(data)

      if (data.status === 'completed' || data.status === 'failed') {
        reachedTerminalState = true
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = undefined
        }
        controller.abort()
      }
    }

    const pollStatus = async () => {
      if (stopped || reachedTerminalState) return

      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Status polling failed: ${response.status}`)
      }
      handleStatus(await response.json())
    }

    const startPolling = () => {
      if (pollTimer || stopped || reachedTerminalState) return

      pollStatus().catch(err => console.error('Document status polling error:', err))
      pollTimer = setInterval(() => {
        pollStatus().catch(err => console.error('Document status polling error:', err))
      }, 2000)
    }

    fetch(streamUrl, {
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
            if (done) {
              if (!reachedTerminalState) {
                startPolling()
              }
              return
            }

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  handleStatus(data)
                  if (reachedTerminalState) {
                    return
                  }
                } catch {
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
          startPolling()
        }
      })

    return () => {
      stopped = true
      if (pollTimer) {
        clearInterval(pollTimer)
      }
      controller.abort()
    }
  }, [docId, collectionId])

  return docId && collectionId ? status : null
}
