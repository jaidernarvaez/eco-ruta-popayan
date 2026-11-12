import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { Role, UserProfile } from '../types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  /** Ciudadano con acceso rápido (inicio de sesión anónimo). */
  isAnonymous: boolean
  loading: boolean
  chooseRole: (role: Exclude<Role, 'admin'>) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Perfil implícito de los ciudadanos anónimos: no se guarda en Firestore. */
const ANONYMOUS_PROFILE: UserProfile = { email: '', role: 'ciudadano' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setProfile(u?.isAnonymous ? ANONYMOUS_PROFILE : null)
        setProfileReady(!u || u.isAnonymous)
        setAuthReady(true)
      }),
    [],
  )

  // Conductores / operadores: el rol vive en users/{uid}
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

  async function chooseRole(role: Exclude<Role, 'admin'>) {
    if (!user || user.isAnonymous) return
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
        isAnonymous: !!user?.isAnonymous,
        loading: !authReady || !profileReady,
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
