'use client'

/**
 * Stub for root type-check only. Real impl in coursify-app/lib/auth-context.tsx.
 */
import { createContext, useContext } from 'react'

interface AuthContextType {
  user: unknown
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={{ user: null, loading: false, signOut: async () => {} }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
