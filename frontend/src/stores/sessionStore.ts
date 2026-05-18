import { create } from 'zustand'
import type { Session, SessionMessage } from '../types/session'

interface SessionState {
  sessions: Session[]
  currentSession: Session | null
  messages: SessionMessage[]
  searchQuery: string

  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
  setCurrentSession: (session: Session | null) => void
  setMessages: (messages: SessionMessage[]) => void
  updateCurrentSession: (updates: Partial<Session>) => void
  setSearchQuery: (query: string) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  searchQuery: '',

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions]
  })),
  removeSession: (id) => set((state) => ({
    sessions: state.sessions.filter(s => s.id !== id)
  })),
  setCurrentSession: (session) => set({ currentSession: session }),
  setMessages: (messages) => set({ messages }),
  updateCurrentSession: (updates) => set((state) => ({
    currentSession: state.currentSession
      ? { ...state.currentSession, ...updates }
      : null,
    sessions: state.sessions.map(s =>
      s.id === state.currentSession?.id ? { ...s, ...updates } : s
    )
  })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  reset: () => set({
    sessions: [],
    currentSession: null,
    messages: [],
    searchQuery: '',
  }),
}))
