import { Leaf, Loader2, LogOut, Repeat } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import RoleSelect from './components/RoleSelect'
import CitizenView from './components/CitizenView'
import DriverView from './components/DriverView'

function Shell() {
  const { user, profile, loading, linkError, chooseRole, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-eco-700">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  if (!user) return <LoginPage linkError={linkError} />
  if (!profile) return <RoleSelect />

  const isDriver = profile.role === 'conductor' || profile.role === 'admin'

  return (
    <div className="flex min-h-full flex-col bg-eco-50 text-slate-800">
      <header className="sticky top-0 z-[1500] flex flex-wrap items-center justify-between gap-2 bg-eco-700 px-3 py-2 text-white shadow sm:px-6 sm:py-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-7 w-7" />
          <h1 className="text-lg font-bold sm:text-xl">EcoRuta Popayán</h1>
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
            {isDriver ? 'Conductor' : 'Ciudadano'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden md:inline">{user.email}</span>
          {profile.role !== 'admin' && (
            <button
              onClick={() => chooseRole(isDriver ? 'ciudadano' : 'conductor')}
              className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25"
            >
              <Repeat className="h-4 w-4" />
              <span className="hidden sm:inline">Cambiar a</span> {isDriver ? 'ciudadano' : 'conductor'}
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/15">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
      <main className="flex-1">{isDriver ? <DriverView /> : <CitizenView />}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
