import { useMemo, useState } from 'react'
import { CalendarClock, MapPin, Recycle, Trash2, Truck as TruckIcon } from 'lucide-react'
import MapaPopayan from './MapaPopayan'
import { useNeighborhoods, useSchedules, useTrucks } from '../hooks/useFirestoreData'
import { distanceMeters } from '../lib/geo'
import { STATUS_LABEL, WASTE_LABEL, type WasteType } from '../types'

type Filter = 'todos' | WasteType

export default function CitizenView() {
  const { items: trucks, error } = useTrucks()
  const { items: neighborhoods } = useNeighborhoods()
  const { items: schedules } = useSchedules()
  const [filter, setFilter] = useState<Filter>('todos')
  const [barrioId, setBarrioId] = useState<string | null>(null)

  const barrio = neighborhoods.find((n) => n.id === barrioId) ?? null

  const visibleTrucks = useMemo(
    () =>
      trucks.filter(
        (t) => t.status !== 'fuera_de_servicio' && (filter === 'todos' || t.wasteType === filter),
      ),
    [trucks, filter],
  )

  const nearby = useMemo(() => {
    if (!barrio) return []
    return visibleTrucks
      .map((t) => ({
        truck: t,
        meters: distanceMeters(
          barrio.center.latitude,
          barrio.center.longitude,
          t.location.latitude,
          t.location.longitude,
        ),
      }))
      .sort((a, b) => a.meters - b.meters)
  }, [barrio, visibleTrucks])

  const barrioSchedules = schedules.filter(
    (s) => s.neighborhoodId === barrioId && (filter === 'todos' || s.wasteType === filter),
  )

  const chip = (value: Filter, label: string) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={`rounded-full px-3 py-1 text-sm font-medium ${
        filter === value ? 'bg-eco-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-[320px_1fr]">
      <aside className="space-y-5 overflow-y-auto rounded-xl bg-white p-4 shadow">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tipo de residuo</h2>
          <div className="flex flex-wrap gap-2">
            {chip('todos', 'Todos')}
            {chip('ordinario', 'Ordinario')}
            {chip('reciclable', 'Reciclable')}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mi barrio</h2>
          <select
            value={barrioId ?? ''}
            onChange={(e) => setBarrioId(e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Selecciona un barrio…</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} (Comuna {n.commune})
              </option>
            ))}
          </select>
          {neighborhoods.length === 0 && (
            <p className="text-xs text-amber-700">
              Aún no hay barrios cargados. Un conductor debe pulsar «Cargar datos de ejemplo».
            </p>
          )}
        </section>

        {barrio && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-4 w-4" /> Horarios en {barrio.name}
            </h2>
            {barrioSchedules.length === 0 && <p className="text-sm text-slate-500">Sin horarios registrados.</p>}
            {barrioSchedules.map((s) => (
              <div key={s.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="flex items-center gap-1 font-medium">
                  {s.wasteType === 'reciclable' ? (
                    <Recycle className="h-4 w-4 text-eco-600" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-slate-600" />
                  )}
                  {WASTE_LABEL[s.wasteType]}
                </p>
                <p className="capitalize text-slate-600">{s.days.join(', ')}</p>
                <p className="text-slate-600">
                  {s.startTime} – {s.endTime}
                </p>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <TruckIcon className="h-4 w-4" /> Camiones activos ({visibleTrucks.length})
          </h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {visibleTrucks.length === 0 && <p className="text-sm text-slate-500">No hay camiones en servicio ahora.</p>}
          {(barrio ? nearby : visibleTrucks.map((t) => ({ truck: t, meters: null as number | null }))).map(
            ({ truck, meters }) => (
              <div key={truck.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm">
                <div>
                  <p className="font-medium">{truck.plate}</p>
                  <p className="text-xs text-slate-500">
                    {WASTE_LABEL[truck.wasteType]} · {STATUS_LABEL[truck.status]}
                  </p>
                </div>
                {meters !== null && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-eco-700">
                    <MapPin className="h-3 w-3" />
                    {meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`}
                  </span>
                )}
              </div>
            ),
          )}
        </section>
      </aside>

      <section className="min-h-[420px] overflow-hidden rounded-xl shadow">
        <MapaPopayan trucks={visibleTrucks} neighborhoods={neighborhoods} selectedNeighborhoodId={barrioId} />
      </section>
    </div>
  )
}
