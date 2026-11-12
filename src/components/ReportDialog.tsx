import { useState, type FormEvent } from 'react'
import { addDoc, collection, GeoPoint, serverTimestamp } from 'firebase/firestore'
import { AlertTriangle, Loader2, Siren, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { REPORT_LABEL, type ReportType } from '../types'

interface Props {
  point: [number, number]
  cityId: string
  cityName: string
  neighborhoodId: string | null
  neighborhoodName: string | null
  onClose: () => void
  onSaved: () => void
}

const MAX = 280

export default function ReportDialog({ point, cityId, cityName, neighborhoodId, neighborhoodName, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [type, setType] = useState<ReportType>('acumulacion')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await addDoc(collection(db, 'reports'), {
        type,
        description: description.trim(),
        location: new GeoPoint(point[0], point[1]),
        city: cityId,
        neighborhoodId,
        status: 'abierto',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el reporte.')
      setSaving(false)
    }
  }

  const option = (value: ReportType, Icon: typeof Siren, hint: string) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 ${
        type === value ? 'border-orange-500 bg-orange-50' : 'border-slate-200'
      }`}
    >
      <input type="radio" name="type" className="sr-only" checked={type === value} onChange={() => setType(value)} />
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
      <span>
        <span className="block text-sm font-semibold">{REPORT_LABEL[value]}</span>
        <span className="block text-xs text-slate-600">{hint}</span>
      </span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Reporte ciudadano</h2>
            <p className="text-xs text-slate-500">
              {cityName} · {neighborhoodName ? `cerca de ${neighborhoodName}` : 'ubicación marcada'} ·{' '}
              {point[0].toFixed(4)}, {point[1].toFixed(4)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {option('acumulacion', AlertTriangle, 'Hay bolsas o residuos acumulados en la calle.')}
          {option('recoleccion_prioritaria', Siren, 'Se necesita que el camión pase lo antes posible.')}
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Descripción (opcional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
            rows={3}
            placeholder="Ej.: esquina de la carrera 6 con calle 4, bolsas rotas desde ayer"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-eco-600"
          />
          <span className="block text-right text-xs text-slate-400">
            {description.length}/{MAX}
          </span>
        </label>

        <p className="text-xs text-slate-500">
          El reporte será visible para conductores y vecinos. No se publica tu correo.
        </p>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 py-2.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar reporte
        </button>
      </form>
    </div>
  )
}
