import { useState } from 'react'
import { Eye, Leaf, Loader2, LogOut, ShieldCheck, Truck } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CityProvider } from './context/CityContext'
import LoginPage from './components/LoginPage'
import CitizenView from './components/CitizenView'
import DriverView from './components/DriverView'

const ROLE_BADGE = {
  admin: 'Administrador',
  conductor: 'Conductor',
  ciudadano: 'Ciudadano · acceso rápido',
} as const

function Shell() {
  const { user, role, isAnonymous, loading, logout } = useAuth()
  // Conductores y admin pueden previsualizar la vista ciudadana (solo cambia la interfaz)
  const [citizenPreview, setCitizenPreview] = useState(false)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-eco-700">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  if (!user || !role) return <LoginPage />

  const operator = role === 'admin' || role === 'conductor'
  const showDriver = operator && !citizenPreview

  return (
    <div className="flex min-h-full flex-col bg-eco-50 text-slate-800">
      <header className="sticky top-0 z-[1500] flex flex-wrap items-center justify-between gap-2 bg-eco-700 px-3 py-2 text-white shadow sm:px-6 sm:py-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-7 w-7" />
          <h1 className="text-lg font-bold sm:text-xl">EcoRuta Colombia</h1>
          <span
            className={`ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
              role === 'admin' ? 'bg-amber-400 font-semibold text-amber-950' : 'bg-white/20'
            }`}
          >
            {role === 'admin' && <ShieldCheck className="h-3.5 w-3.5" />}
            {ROLE_BADGE[role]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {user.email && <span className="hidden md:inline">{user.email}</span>}
          {isAnonymous && (
            <button
              onClick={logout}
              title="Cierra el acceso rápido y vuelve a la pantalla de ingreso"
              className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25"
            >
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Soy</span> conductor
            </button>
          )}
          {operator && (
            <button
              onClick={() => setCitizenPreview((v) => !v)}
              className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25"
            >
              {citizenPreview ? <Truck className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {citizenPreview ? 'Volver al panel' : <span>Ver como ciudadano</span>}
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/15">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
      <main className="flex-1">{showDriver ? <DriverView /> : <CitizenView />}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CityProvider>
        <Shell />
      </CityProvider>
    </AuthProvider>
  )
}
