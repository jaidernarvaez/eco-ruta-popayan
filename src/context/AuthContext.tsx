import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { completeMagicLinkIfPresent } from '../lib/magicLink'
import type { Role, UserProfile } from '../types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  linkError: string | null
  chooseRole: (role: Exclude<Role, 'admin'>) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    completeMagicLinkIfPresent().catch((e: unknown) => {
      setLinkError(e instanceof Error ? e.message : 'El enlace no es válido o ya expiró.')
    })
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setProfile(null)
      setProfileReady(!u)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
        setProfileReady(true)
      },
      () => setProfileReady(true),
    )
  }, [user])

  async function chooseRole(role: Exclude<Role, 'admin'>) {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    if (profile) {
      await updateDoc(ref, { role })
    } else {
      await setDoc(ref, { email: user.email, role, createdAt: serverTimestamp() })
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading: !authReady || !profileReady,
        linkError,
        chooseRole,
        logout: () => signOut(auth),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
