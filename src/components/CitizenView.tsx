import { useEffect, useMemo, useState } from 'react'
import { Crosshair, Megaphone, MapPin, Recycle, Trash2, Truck as TruckIcon, X } from 'lucide-react'
import MapaCiudad from './MapaCiudad'
import CitySelect from './CitySelect'
import ReportDialog from './ReportDialog'
import ProximityBanner from './ProximityBanner'
import ScheduleCard from './ScheduleCard'
import ReportsStatusPanel from './ReportsStatusPanel'
import GreenWallet from './GreenWallet'
import { useAuth } from '../context/AuthContext'
import { useCity } from '../context/CityContext'
import { cityOf, useNeighborhoods, useRecentReports, useTrucks } from '../hooks/useFirestoreData'
import { timeAgo, useNow } from '../hooks/useNow'
import {
  TRAFFIC_LABEL,
  distanceMeters,
  estimateTrip,
  formatDistance,
  formatTripBreakdown,
  formatTripTotal,
  insideCity,
  nearestNeighborhood,
  resolveTraffic,
} from '../lib/geo'
import { STATUS_LABEL, WASTE_LABEL, reportStage, type Truck, type WasteType } from '../types'

type Filter = 'todos' | WasteType

const STATUS_STYLE: Record<Truck['status'], string> = {
  en_ruta: 'bg-eco-500/15 text-eco-700',
  detenido: 'bg-amber-100 text-amber-800',
  fuera_de_servicio: 'bg-slate-100 text-slate-500',
}

export default function CitizenView() {
  const { user, isAnonymous } = useAuth()
  const { city } = useCity()
  const { items: allTrucks, error } = useTrucks()
  const { items: neighborhoods } = useNeighborhoods(city.id)
  const { items: allReports } = useRecentReports(72)
  const now = useNow(10000)

  // Solo datos de la ciudad activa
  const trucks = useMemo(() => allTrucks.filter((t) => cityOf(t) === city.id), [allTrucks, city.id])
  const cityReports = useMemo(() => allReports.filter((r) => cityOf(r) === city.id), [allReports, city.id])
  const openReports = useMemo(() => cityReports.filter((r) => reportStage(r) !== 'atendido'), [cityReports])

  const [filter, setFilter] = useState<Filter>('todos')
  const [barrioId, setBarrioId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<[number, number] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [focus, setFocus] = useState<[number, number] | null>(null)

  // Ubicación GPS opcional del ciudadano
  const [gpsOn, setGpsOn] = useState(false)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)

  useEffect(() => {
    if (!gpsOn || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setUserPos([p.coords.latitude, p.coords.longitude])
        setGpsError(null)
      },
      () => {
        setGpsError('No se pudo obtener tu ubicación. Usaremos el barrio elegido.')
        setGpsOn(false)
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [gpsOn])

  const barrio = neighborhoods.find((n) => n.id === barrioId) ?? null
  const gpsInCity = !!userPos && insideCity(userPos[0], userPos[1], city)

  /** Punto desde el que se miden distancias y tiempos: GPS (si está en la ciudad) o el barrio. */
  const reference = useMemo(() => {
    if (gpsOn && userPos && gpsInCity) return { lat: userPos[0], lng: userPos[1], label: 'tu ubicación' }
    if (barrio) return { lat: barrio.center.latitude, lng: barrio.center.longitude, label: `tu zona (${barrio.name})` }
    return null
  }, [gpsOn, userPos, gpsInCity, barrio])

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
      meters: reference
        ? distanceMeters(reference.lat, reference.lng, truck.location.latitude, truck.location.longitude)
        : null,
    }))
    return reference ? list.sort((a, b) => a.meters! - b.meters!) : list
  }, [reference, visibleTrucks])

  function placeDraft(lat: number, lng: number) {
    if (!insideCity(lat, lng, city)) {
      setNotice(`Ese punto está fuera del área de ${city.name}.`)
      return
    }
    setNotice(null)
    setDraft([lat, lng])
    setPicking(false)
  }

  function locateForReport() {
    if (userPos && gpsInCity) {
      placeDraft(userPos[0], userPos[1])
      return
    }
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
      {/* Barra superior: filtros, ciudad, barrio y reporte */}
      <section className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {chip('todos', 'Todos')}
          {chip('ordinario', 'Ordinarios', Trash2)}
          {chip('reciclable', 'Reciclables', Recycle)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <CitySelect
            onChange={() => {
              setBarrioId(null)
              setDraft(null)
              setPicking(false)
              setNotice(null)
              setFocus(null)
            }}
          />
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
            <MapPin className="h-4 w-4 shrink-0 text-eco-600" />
            <select
              value={barrioId ?? ''}
              onChange={(e) => setBarrioId(e.target.value || null)}
              className="w-full bg-transparent py-2 outline-none sm:w-56"
              aria-label="Selecciona tu barrio"
            >
              <option value="">Barrio en {city.name}…</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                  {n.commune > 0 ? ` · ${city.zoneLabel} ${n.commune}` : ''}
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

      {/* Alerta de proximidad + ETA */}
      <ProximityBanner
        cityName={city.name}
        trucks={visibleTrucks}
        reference={reference}
        gpsOn={gpsOn}
        gpsError={gpsError ?? (gpsOn && userPos && !gpsInCity ? `Tu ubicación está fuera de ${city.name}; usamos el barrio elegido.` : null)}
        onToggleGps={() => {
          if (!gpsOn && !navigator.geolocation) {
            setGpsError('Tu navegador no permite obtener la ubicación.')
            return
          }
          setGpsError(null)
          setGpsOn((v) => !v)
        }}
      />

      {picking && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-orange-400 bg-orange-50 p-3 text-sm text-orange-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Toca el mapa en el punto donde hay acumulación de residuos.</p>
          <div className="flex gap-2">
            <button onClick={locateForReport} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-medium shadow-sm">
              <Crosshair className="h-4 w-4" /> Usar mi ubicación
            </button>
            <button onClick={() => setPicking(false)} className="flex items-center gap-1 rounded-lg px-3 py-1.5">
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        </section>
      )}
      {notice && <p className="rounded-lg bg-eco-50 p-3 text-sm text-eco-900 ring-1 ring-eco-500/30">{notice}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="h-[55vh] min-h-[360px] overflow-hidden rounded-xl shadow lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
          <MapaCiudad
            city={city}
            trucks={visibleTrucks}
            neighborhoods={neighborhoods}
            reports={openReports}
            selectedNeighborhoodId={barrioId}
            draftPoint={draft}
            userPoint={gpsOn && gpsInCity ? userPos : null}
            focus={focus}
            picking={picking}
            onMapClick={picking ? placeDraft : undefined}
          />
        </section>

        <aside className="space-y-4">
          {/* Horarios fijos del barrio */}
          <ScheduleCard zoneId={barrioId} zoneName={barrio?.name ?? null} filter={filter} now={now} />

          {/* Estado en vivo de los camiones */}
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-eco-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-eco-600" />
              </span>
              Camiones en vivo · {city.name}
            </h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {live.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <TruckIcon className="h-4 w-4" /> No hay camiones en servicio en {city.name} ahora.
              </p>
            )}
            <ul className="space-y-2">
              {live.map(({ truck, meters }, i) => (
                <li
                  key={truck.id}
                  className={`rounded-lg border p-3 ${i === 0 && reference ? 'border-eco-500 bg-eco-50' : 'border-slate-200'}`}
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
                        <strong className="text-eco-700">
                          a {formatDistance(meters)} · {formatTripTotal(estimateTrip(meters, resolveTraffic(truck.traffic)))}
                        </strong>
                      ) : (
                        'Elige tu barrio para ver distancia y tiempo'
                      )}
                    </span>
                    <span>{timeAgo(truck.updatedAt?.toMillis(), now)}</span>
                  </div>
                  {meters !== null && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatTripBreakdown(estimateTrip(meters, resolveTraffic(truck.traffic)))} · tráfico{' '}
                      {TRAFFIC_LABEL[resolveTraffic(truck.traffic)].toLowerCase()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Trazabilidad de reportes */}
          <ReportsStatusPanel
            cityName={city.name}
            reports={cityReports}
            neighborhoods={neighborhoods}
            uid={user?.uid}
            now={now}
            zoneId={barrioId}
            onFocus={setFocus}
          />

          {/* Billetera Verde: EcoPuntos por reportes recolectados (canje simulado) */}
          {user && <GreenWallet key={user.uid} uid={user.uid} isAnonymous={isAnonymous} />}
        </aside>
      </div>

      {draft && (
        <ReportDialog
          point={draft}
          cityId={city.id}
          cityName={city.name}
          neighborhoodId={draftBarrioId}
          neighborhoodName={neighborhoods.find((n) => n.id === draftBarrioId)?.name ?? null}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            setNotice('¡Gracias! Tu reporte quedó como «Pendiente». Verás aquí cuando un conductor vaya en camino y cuando sea recolectado.')
          }}
        />
      )}
    </div>
  )
}
