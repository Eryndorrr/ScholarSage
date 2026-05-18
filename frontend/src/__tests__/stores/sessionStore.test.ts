import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../stores/sessionStore'
import type { Session } from '../../types/session'

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  const mockSession: Session = {
    id: 'session-1',
    title: 'Test Session',
    message_count: 0,
    web_search_enabled: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  it('should initialize with default values', () => {
    const state = useSessionStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.currentSession).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.searchQuery).toBe('')
  })

  it('should add session to beginning of list', () => {
    useSessionStore.getState().addSession(mockSession)
    const sessions = useSessionStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('session-1')
  })

  it('should remove session', () => {
    useSessionStore.getState().addSession(mockSession)
    useSessionStore.getState().removeSession('session-1')
    expect(useSessionStore.getState().sessions).toHaveLength(0)
  })

  it('should set current session', () => {
    useSessionStore.getState().setCurrentSession(mockSession)
    expect(useSessionStore.getState().currentSession?.id).toBe('session-1')
  })

  it('should update current session and sync to list', () => {
    useSessionStore.getState().addSession(mockSession)
    useSessionStore.getState().setCurrentSession(mockSession)
    useSessionStore.getState().updateCurrentSession({ title: 'Updated Title' })

    const state = useSessionStore.getState()
    expect(state.currentSession?.title).toBe('Updated Title')
    expect(state.sessions[0].title).toBe('Updated Title')
  })

  it('should set search query', () => {
    useSessionStore.getState().setSearchQuery('test query')
    expect(useSessionStore.getState().searchQuery).toBe('test query')
  })

  it('should reset all state', () => {
    useSessionStore.getState().addSession(mockSession)
    useSessionStore.getState().setCurrentSession(mockSession)
    useSessionStore.getState().setMessages([{ id: 'm1', role: 'user', content: 'test', created_at: '' }])
    useSessionStore.getState().setSearchQuery('test')

    useSessionStore.getState().reset()

    const state = useSessionStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.currentSession).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.searchQuery).toBe('')
  })
})
