import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { ADMIN_EMAIL } from '../config/admin'
import type { Role, UserProfile } from '../types'

interface AuthState {
  user: User | null
  /**
   * Rol efectivo:
   *  - ciudadano: acceso rápido anónimo
   *  - admin: correo de administrador verificado, o role == 'admin' en users/{uid}
   *  - conductor: cualquier otra cuenta (Google o correo/contraseña)
   */
  role: Role | null
  isAdmin: boolean
  isAnonymous: boolean
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function isAdminUser(user: User | null, profile: UserProfile | null) {
  if (!user || user.isAnonymous) return false
  const byEmail = user.emailVerified && (user.email ?? '').toLowerCase() === ADMIN_EMAIL
  return byEmail || profile?.role === 'admin'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setProfile(null)
        setProfileReady(!u || u.isAnonymous)
        setAuthReady(true)
      }),
    [],
  )

  // users/{uid} solo se usa para detectar role == 'admin' asignado desde la consola
  useEffect(() => {
    if (!user || user.isAnonymous) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
        setProfileReady(true)
      },
      () => setProfileReady(true),
    )
  }, [user])

  const isAnonymous = !!user?.isAnonymous
  const isAdmin = isAdminUser(user, profile)
  const role: Role | null = !user ? null : isAnonymous ? 'ciudadano' : isAdmin ? 'admin' : 'conductor'

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isAnonymous,
        loading: !authReady || !profileReady,
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
