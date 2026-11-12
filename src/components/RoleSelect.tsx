import { useState } from 'react'
import { Users, Truck, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function RoleSelect() {
  const { user, chooseRole, logout } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(role: 'ciudadano' | 'conductor') {
    setSaving(true)
    setError(null)
    try {
      await chooseRole(role)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el rol.')
      setSaving(false)
    }
  }

  const card =
    'flex flex-1 flex-col items-center gap-3 rounded-xl border-2 border-slate-200 p-6 text-center hover:border-eco-600 hover:bg-eco-50 disabled:opacity-50'

  return (
    <div className="flex min-h-full items-center justify-center bg-eco-50 p-4">
      <div className="w-full max-w-xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-xl font-bold text-eco-900">¿Cómo vas a usar EcoRuta?</h1>
          <p className="text-sm text-slate-600">Sesión iniciada como {user?.email}</p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <button className={card} disabled={saving} onClick={() => pick('ciudadano')}>
            <Users className="h-10 w-10 text-eco-600" />
            <span className="font-semibold">Ciudadano</span>
            <span className="text-sm text-slate-600">Ver camiones en tiempo real y horarios de mi barrio y mi ciudad</span>
          </button>
          <button className={card} disabled={saving} onClick={() => pick('conductor')}>
            <Truck className="h-10 w-10 text-eco-600" />
            <span className="font-semibold">Conductor / Simulador</span>
            <span className="text-sm text-slate-600">Mover un camión sobre el mapa y reportar su estado</span>
          </button>
        </div>
        {saving && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button onClick={logout} className="w-full text-sm text-slate-500 underline">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
