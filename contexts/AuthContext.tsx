'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Session = {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  access_token?: string
  refresh_token?: string
}

type AuthState = {
  session: Session | null
  user: Session['user'] | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const SESSION_RETRY_DELAY_MS = 250
const AUTH_INIT_TIMEOUT_MS = 8000

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const hydrateFromServer = useCallback(async (): Promise<Session | null> => {
    if (typeof window === 'undefined') return null
    const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    const serverSession = data?.session
    if (serverSession?.user && serverSession?.access_token && serverSession?.refresh_token) {
      try {
        await supabase.auth.setSession({
          access_token: serverSession.access_token,
          refresh_token: serverSession.refresh_token,
        })
      } catch {
        return serverSession as Session
      }
      return serverSession as Session
    }
    return null
  }, [])

  const refreshSession = useCallback(async () => {
    const fromServer = await hydrateFromServer()
    if (fromServer?.user) {
      setSession(fromServer)
      return
    }
    const { data: { session: s } } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_INIT_TIMEOUT_MS,
      { data: { session: null }, error: null },
    )
    if (s?.user) setSession(s as Session)
    else setSession(null)
  }, [hydrateFromServer])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('coursify:hydrated'))
    ;(window as unknown as { __coursifyHydrated?: boolean }).__coursifyHydrated = true
  }, [])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSession(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const init = async (retryCount = 0) => {
      try {
        const fromServer = await hydrateFromServer()
        if (cancelled) return
        if (fromServer?.user) {
          setSession(fromServer)
          return
        }

        // No server session — trust cookie state; skip client getSession (avoids auth-lock hangs).
        if (retryCount < 1) {
          await new Promise((r) => setTimeout(r, SESSION_RETRY_DELAY_MS))
          if (cancelled) return
          const again = await hydrateFromServer()
          if (cancelled) return
          if (again?.user) {
            setSession(again)
            return
          }
        }

        setSession(null)
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return
      setSession(s as Session | null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [hydrateFromServer])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    setSession(null)
  }, [])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: !!session?.user,
    signOut,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
