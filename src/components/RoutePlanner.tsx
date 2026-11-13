import { Eraser, PenLine, Route, Save, Sparkles, Undo2, Wand2, X } from 'lucide-react'
import { routeLengthMeters, type LatLng } from '../lib/geo'
import { timeAgo, useNow } from '../hooks/useNow'

interface Props {
  plate: string
  truckPos: LatLng
  truckInCity: boolean
  cityName: string
  stops: LatLng[]
  savedCount: number
  dirty: boolean
  routeUpdatedAt: number | null
  editing: boolean
  busy: boolean
  openReports: number
  onToggleEditing: () => void
  onUndo: () => void
  onClear: () => void
  onSave: () => void
  onDiscard: () => void
  onOptimizeReports: () => void
  onOptimizeOrder: () => void
}

const btn =
  'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40'

/** Panel del conductor para dibujar, optimizar y guardar el trazado de su camión. */
export default function RoutePlanner(p: Props) {
  const now = useNow(30000)
  const stopsKm = routeLengthMeters(p.stops) / 1000
  const totalKm = routeLengthMeters([p.truckPos, ...p.stops]) / 1000
  const minutes = Math.round((totalKm / 20) * 60)

  return (
    <section
      className={`rounded-xl bg-white p-4 shadow ring-2 transition ${p.editing ? 'ring-violet-500' : 'ring-transparent'}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Route className="h-4 w-4" /> Trazado de ruta · {p.plate}
          </h2>
          {!p.truckInCity ? (
            <p className="text-sm text-amber-700">
              Este camión está en otra ciudad. Inicia su ruta en {p.cityName} para editar el trazado aquí.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span>
                  <strong className="text-lg text-slate-800">{p.stops.length}</strong> paradas
                </span>
                <span>
                  <strong className="text-lg text-slate-800">{totalKm.toFixed(2).replace('.', ',')}</strong> km totales
                </span>
                <span className="text-slate-500">
                  ({stopsKm.toFixed(2).replace('.', ',')} km entre paradas · ~{minutes} min a 20 km/h)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {p.editing
                  ? 'Modo edición activo: clic en el mapa para agregar una parada; clic sobre una parada numerada para quitarla.'
                  : p.dirty
                    ? 'Hay cambios sin guardar.'
                    : p.savedCount > 0
                      ? `Trazado guardado ${p.routeUpdatedAt ? timeAgo(p.routeUpdatedAt, now) : ''}. «Recorrer mi trazado» lo seguirá.`
                      : 'Sin trazado propio: el simulador usa la ruta demo de la ciudad.'}
              </p>
            </>
          )}
        </div>

        {p.truckInCity && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-[640px] lg:justify-end">
            <button
              onClick={p.onToggleEditing}
              className={`${btn} col-span-2 ${
                p.editing ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-violet-100 text-violet-800 hover:bg-violet-200'
              }`}
            >
              <PenLine className="h-4 w-4" />
              {p.editing ? 'Terminar edición' : 'Editar ruta en el mapa'}
            </button>
            <button onClick={p.onUndo} disabled={p.stops.length === 0} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              <Undo2 className="h-4 w-4" /> Deshacer último punto
            </button>
            <button onClick={p.onClear} disabled={p.stops.length === 0} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              <Eraser className="h-4 w-4" /> Limpiar ruta
            </button>
            <button
              onClick={p.onOptimizeOrder}
              disabled={p.stops.length < 2}
              className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
              title="Reordena las paradas actuales para recorrer menos distancia"
            >
              <Wand2 className="h-4 w-4" /> Optimizar orden
            </button>
            {p.dirty && (
              <button onClick={p.onDiscard} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                <X className="h-4 w-4" /> Descartar cambios
              </button>
            )}
            <button
              onClick={p.onSave}
              disabled={!p.dirty}
              className={`${btn} col-span-2 bg-eco-600 text-white hover:bg-eco-700`}
            >
              <Save className="h-4 w-4" /> Guardar trazado en Firestore
            </button>
            <button
              onClick={p.onOptimizeReports}
              disabled={p.busy || p.openReports === 0}
              className={`${btn} col-span-2 bg-orange-600 text-white hover:bg-orange-700`}
              title="Une las paradas actuales con los reportes pendientes y en ruta, y las ordena (vecino más cercano + 2-opt)"
            >
              <Sparkles className="h-4 w-4" />
              {p.busy ? 'Calculando…' : `Optimizar ruta con reportes activos (${p.openReports})`}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
