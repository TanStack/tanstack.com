import React from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export { SignInButton, SignInButtons } from './SignInButton'
export { UserButton } from './UserButton'
export { UserProfile } from './UserProfile'

// Simple conditional components using Convex queries
export function SignedIn({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.auth.getCurrentUser)
  return user ? <>{children}</> : null
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.auth.getCurrentUser)
  return !user ? <>{children}</> : null
}

// Custom hook for auth state
export function useAuth() {
  const user = useQuery(api.auth.getCurrentUser)
  return {
    user,
    isSignedIn: !!user,
    isLoading: user === undefined,
  }
}
