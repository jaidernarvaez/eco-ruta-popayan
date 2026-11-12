import { useMemo, useState } from 'react'
import { deleteDoc, doc } from 'firebase/firestore'
import {
  CalendarClock,
  Crosshair,
  Megaphone,
  MapPin,
  Recycle,
  Trash2,
  Truck as TruckIcon,
  X,
} from 'lucide-react'
import MapaPopayan from './MapaPopayan'
import ReportDialog from './ReportDialog'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useNeighborhoods, useOpenReports, useSchedules, useTrucks } from '../hooks/useFirestoreData'
import { timeAgo, useNow } from '../hooks/useNow'
import { distanceMeters, formatDistance, insidePopayan, nearestNeighborhood } from '../lib/geo'
import { REPORT_LABEL, STATUS_LABEL, WASTE_LABEL, type Truck, type WasteType } from '../types'

type Filter = 'todos' | WasteType

const STATUS_STYLE: Record<Truck['status'], string> = {
  en_ruta: 'bg-eco-500/15 text-eco-700',
  detenido: 'bg-amber-100 text-amber-800',
  fuera_de_servicio: 'bg-slate-100 text-slate-500',
}

export default function CitizenView() {
  const { user } = useAuth()
  const { items: trucks, error } = useTrucks()
  const { items: neighborhoods } = useNeighborhoods()
  const { items: schedules } = useSchedules()
  const { items: reports } = useOpenReports()
  const now = useNow(10000)

  const [filter, setFilter] = useState<Filter>('todos')
  const [barrioId, setBarrioId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<[number, number] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const barrio = neighborhoods.find((n) => n.id === barrioId) ?? null

  const activeTrucks = useMemo(() => trucks.filter((t) => t.status !== 'fuera_de_servicio'), [trucks])
  const visibleTrucks = useMemo(
    () => activeTrucks.filter((t) => filter === 'todos' || t.wasteType === filter),
    [activeTrucks, filter],
  )
  const counts = {
    todos: activeTrucks.length,
    ordinario: activeTrucks.filter((t) => t.wasteType === 'ordinario').length,
    reciclable: activeTrucks.filter((t) => t.wasteType === 'reciclable').length,
  }

  const live = useMemo(() => {
    const list = visibleTrucks.map((truck) => ({
      truck,
      meters: barrio
        ? distanceMeters(barrio.center.latitude, barrio.center.longitude, truck.location.latitude, truck.location.longitude)
        : null,
    }))
    return barrio ? list.sort((a, b) => a.meters! - b.meters!) : list
  }, [barrio, visibleTrucks])

  const barrioSchedules = schedules.filter(
    (s) => s.neighborhoodId === barrioId && (filter === 'todos' || s.wasteType === filter),
  )
  const myReports = reports.filter((r) => r.createdBy === user?.uid)

  function placeDraft(lat: number, lng: number) {
    if (!insidePopayan(lat, lng)) {
      setNotice('Ese punto está fuera del área urbana de Popayán.')
      return
    }
    setNotice(null)
    setDraft([lat, lng])
    setPicking(false)
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setNotice('Tu navegador no permite obtener la ubicación.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => placeDraft(p.coords.latitude, p.coords.longitude),
      () => setNotice('No se pudo obtener tu ubicación. Marca el punto tocando el mapa.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const draftBarrioId = draft ? nearestNeighborhood(draft[0], draft[1], neighborhoods) : null

  const chip = (value: Filter, label: string, Icon?: typeof Recycle) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        filter === value ? 'bg-eco-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
      <span className={`rounded-full px-1.5 text-xs ${filter === value ? 'bg-white/25' : 'bg-white'}`}>
        {counts[value]}
      </span>
    </button>
  )

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* Barra superior: filtros, barrio y reporte */}
      <section className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {chip('todos', 'Todos')}
          {chip('ordinario', 'Ordinarios', Trash2)}
          {chip('reciclable', 'Reciclables', Recycle)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
            <MapPin className="h-4 w-4 shrink-0 text-eco-600" />
            <select
              value={barrioId ?? ''}
              onChange={(e) => setBarrioId(e.target.value || null)}
              className="w-full bg-transparent py-2 outline-none sm:w-56"
              aria-label="Selecciona tu barrio"
            >
              <option value="">Selecciona tu barrio…</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · Comuna {n.commune}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setPicking(true)
              setDraft(null)
              setNotice(null)
            }}
            className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white shadow hover:bg-orange-700"
          >
            <Megaphone className="h-4 w-4" /> Reporte ciudadano
          </button>
        </div>
      </section>

      {picking && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-orange-400 bg-orange-50 p-3 text-sm text-orange-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Toca el mapa en el punto donde hay acumulación de residuos.</p>
          <div className="flex gap-2">
            <button onClick={locateMe} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-medium shadow-sm">
              <Crosshair className="h-4 w-4" /> Usar mi ubicación
            </button>
            <button onClick={() => setPicking(false)} className="flex items-center gap-1 rounded-lg px-3 py-1.5">
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        </section>
      )}
      {notice && <p className="rounded-lg bg-eco-50 p-3 text-sm text-eco-900 ring-1 ring-eco-500/30">{notice}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <section className="h-[55vh] min-h-[360px] overflow-hidden rounded-xl shadow lg:h-[calc(100vh-13rem)]">
          <MapaPopayan
            trucks={visibleTrucks}
            neighborhoods={neighborhoods}
            reports={reports}
            selectedNeighborhoodId={barrioId}
            draftPoint={draft}
            picking={picking}
            onMapClick={picking ? placeDraft : undefined}
          />
        </section>

        <aside className="space-y-4">
          {/* Estado en vivo */}
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-eco-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-eco-600" />
              </span>
              Estado en vivo {barrio && <span className="normal-case text-slate-400">· desde {barrio.name}</span>}
            </h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {live.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <TruckIcon className="h-4 w-4" /> No hay camiones en servicio ahora.
              </p>
            )}
            <ul className="space-y-2">
              {live.map(({ truck, meters }, i) => (
                <li
                  key={truck.id}
                  className={`rounded-lg border p-3 ${i === 0 && barrio ? 'border-eco-500 bg-eco-50' : 'border-slate-200'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {truck.wasteType === 'reciclable' ? (
                        <Recycle className="h-5 w-5 text-eco-600" />
                      ) : (
                        <Trash2 className="h-5 w-5 text-slate-600" />
                      )}
                      <div>
                        <p className="font-mono font-bold tracking-wide">{truck.plate}</p>
                        <p className="text-xs text-slate-500">{WASTE_LABEL[truck.wasteType]}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[truck.status]}`}>
                      {STATUS_LABEL[truck.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {meters !== null ? (
                        <strong className="text-eco-700">a {formatDistance(meters)}</strong>
                      ) : (
                        'Elige tu barrio para ver la distancia'
                      )}
                      {i === 0 && barrio && ' · el más cercano'}
                    </span>
                    <span>{timeAgo(truck.updatedAt?.toMillis(), now)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Horarios */}
          {barrio && (
            <section className="rounded-xl bg-white p-4 shadow">
              <h2 className="mb-3 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <CalendarClock className="h-4 w-4" /> Horarios en {barrio.name}
              </h2>
              {barrioSchedules.length === 0 && <p className="text-sm text-slate-500">Sin horarios registrados aún.</p>}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
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
              </div>
            </section>
          )}

          {/* Mis reportes */}
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <Megaphone className="h-4 w-4" /> Mis reportes abiertos ({myReports.length})
            </h2>
            {myReports.length === 0 && (
              <p className="text-sm text-slate-500">
                ¿Ves bolsas acumuladas? Usa «Reporte ciudadano» y el conductor lo verá en su mapa.
              </p>
            )}
            <ul className="space-y-2">
              {myReports.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg bg-orange-50 p-2 text-sm">
                  <div>
                    <p className="font-medium text-orange-900">{REPORT_LABEL[r.type]}</p>
                    <p className="text-xs text-orange-800/80">
                      {neighborhoods.find((n) => n.id === r.neighborhoodId)?.name ?? 'Sin barrio'} ·{' '}
                      {timeAgo(r.createdAt?.toMillis(), now)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteDoc(doc(db, 'reports', r.id))}
                    className="text-xs text-orange-700 underline"
                  >
                    Retirar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {draft && (
        <ReportDialog
          point={draft}
          neighborhoodId={draftBarrioId}
          neighborhoodName={neighborhoods.find((n) => n.id === draftBarrioId)?.name ?? null}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            setNotice('¡Gracias! Tu reporte quedó registrado y ya aparece en el mapa de los conductores.')
          }}
        />
      )}
    </div>
  )
}
