import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GeoPoint,
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  MapPinned,
  MousePointerClick,
  Navigation,
  Pause,
  Play,
  Plus,
  Siren,
  Trash,
  Truck as TruckIcon,
  Zap,
} from 'lucide-react'
import MapaCiudad from './MapaCiudad'
import CitySelect from './CitySelect'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useCity } from '../context/CityContext'
import { cityOf, useNeighborhoods, useRecentReports, useTrucks } from '../hooks/useFirestoreData'
import { timeAgo, useNow } from '../hooks/useNow'
import { seedBaseData } from '../data/seed'
import { DEMO_TRUCKS, getCity, routeFor } from '../data/cities'
import { distanceMeters, formatDistance, insideCity, nearestNeighborhood } from '../lib/geo'
import { REPORT_LABEL, STAGE_BADGE, STAGE_LABEL, STATUS_LABEL, reportStage, type Neighborhood, type Report, type Truck, type TruckStatus, type WasteType } from '../types'

const STEP_DEG = 0.0007 // ~78 m por paso
const TICK_MS = 2000 // recorrido de un camión: una escritura cada 2 s
const TICK_ALL_MS = 4000 // recorrido de todos los camiones demo: cada 4 s (cuida la cuota gratuita)

const card = 'rounded-xl bg-white p-4 shadow space-y-3'
const cardTitle = 'flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500'
const btn = 'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'

/** Siguiente posición de un camión que avanza por una ruta (puntos de barrio). */
function stepAlong(pos: [number, number], route: [number, number][], waypoint: number) {
  const target = route[waypoint % route.length]
  const dLat = target[0] - pos[0]
  const dLng = target[1] - pos[1]
  const dist = Math.hypot(dLat, dLng)
  if (dist <= STEP_DEG) return { next: target, waypoint: waypoint + 1 }
  return { next: [pos[0] + (dLat / dist) * STEP_DEG, pos[1] + (dLng / dist) * STEP_DEG] as [number, number], waypoint }
}

export default function DriverView() {
  const { user } = useAuth()
  const { city, setCityId } = useCity()
  const { items: allTrucks, error } = useTrucks()
  const { items: neighborhoods, stored } = useNeighborhoods(city.id)
  const { items: allNeighborhoods } = useNeighborhoods()
  const { items: allReports } = useRecentReports(72)
  const now = useNow(15000)

  const trucks = useMemo(() => allTrucks.filter((t) => cityOf(t) === city.id), [allTrucks, city.id])
  // Reportes por atender (pendientes o en ruta) de la ciudad activa
  const reports = useMemo(
    () => allReports.filter((r) => cityOf(r) === city.id && reportStage(r) !== 'atendido'),
    [allReports, city.id],
  )

  // Mis camiones en todas las ciudades
  const myTrucks = useMemo(() => allTrucks.filter((t) => t.driverId === user?.uid), [allTrucks, user])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const myTruck = myTrucks.find((t) => t.id === selectedId) ?? myTrucks.find((t) => cityOf(t) === city.id) ?? myTrucks[0] ?? null

  const [plate, setPlate] = useState('')
  const [wasteType, setWasteType] = useState<WasteType>('ordinario')
  const [message, setMessage] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simulatingAll, setSimulatingAll] = useState(false)
  const [lastWrite, setLastWrite] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState<[number, number] | null>(null)

  const route = useMemo(() => routeFor(city.id), [city.id])
  const posRef = useRef<[number, number] | null>(null)
  const waypointRef = useRef(0)
  const allStateRef = useRef<Record<string, { pos: [number, number]; waypoint: number }>>({})

  const fail = (e: unknown) => setMessage(e instanceof Error ? e.message : String(e))

  useEffect(() => {
    if (myTruck) posRef.current = [myTruck.location.latitude, myTruck.location.longitude]
  }, [myTruck])

  // Al cambiar de ciudad se detienen los recorridos y se limpia el foco
  function onCityChange(cityId: string) {
    setSimulating(false)
    setFocus(null)
    const mine = myTrucks.find((t) => cityOf(t) === cityId)
    setSelectedId(mine?.id ?? null)
    waypointRef.current = 0
  }

  const reportsByDistance = useMemo(() => {
    const from: [number, number] =
      myTruck && cityOf(myTruck) === city.id
        ? [myTruck.location.latitude, myTruck.location.longitude]
        : [city.lat, city.lng]
    return reports
      .map((r) => ({ r, meters: distanceMeters(from[0], from[1], r.location.latitude, r.location.longitude) }))
      .sort((a, b) => {
        // Primero los que ya tomé (en ruta), luego los prioritarios, luego por distancia
        const ea = reportStage(a.r) === 'en_ruta' ? 0 : 1
        const eb = reportStage(b.r) === 'en_ruta' ? 0 : 1
        if (ea !== eb) return ea - eb
        const pa = a.r.type === 'recoleccion_prioritaria' ? 0 : 1
        const pb = b.r.type === 'recoleccion_prioritaria' ? 0 : 1
        return pa - pb || a.meters - b.meters
      })
  }, [reports, myTruck, city])

  /** Escribe la nueva posición de un camión en Firestore (con su ciudad y barrio más cercano). */
  async function writePosition(
    truck: Truck,
    lat: number,
    lng: number,
    cityId: string,
    zones: Neighborhood[],
    extra: Record<string, unknown> = {},
  ) {
    await updateDoc(doc(db, 'trucks', truck.id), {
      location: new GeoPoint(lat, lng),
      city: cityId,
      neighborhoodId: nearestNeighborhood(lat, lng, zones, 900),
      updatedAt: serverTimestamp(),
      ...extra,
    })
  }

  async function moveTruck(lat: number, lng: number, extra: Record<string, unknown> = {}) {
    if (!myTruck) {
      setMessage('Primero registra o selecciona un camión.')
      return
    }
    if (!insideCity(lat, lng, city)) {
      setMessage(`Esa ubicación está fuera del área de ${city.name}.`)
      return
    }
    await writePosition(myTruck, lat, lng, city.id, neighborhoods, extra)
    posRef.current = [lat, lng]
    setLastWrite(new Date().toLocaleTimeString('es-CO'))
  }

  // Recorrido automático del camión seleccionado (en la ciudad activa)
  useEffect(() => {
    if (!simulating || !myTruck || route.length < 2) return
    const id = window.setInterval(() => {
      if (!posRef.current) return
      const { next, waypoint } = stepAlong(posRef.current, route, waypointRef.current)
      waypointRef.current = waypoint
      moveTruck(next[0], next[1], { status: 'en_ruta' }).catch((e) => {
        fail(e)
        setSimulating(false)
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [simulating, myTruck?.id, route])

  // Recorrido simultáneo de todos mis camiones, cada uno en la ruta demo de su ciudad
  useEffect(() => {
    if (!simulatingAll) return
    const id = window.setInterval(() => {
      for (const t of myTrucks) {
        const tCity = cityOf(t)
        const tRoute = routeFor(tCity)
        if (tRoute.length < 2) continue
        const st = allStateRef.current[t.id] ?? {
          pos: [t.location.latitude, t.location.longitude] as [number, number],
          waypoint: 0,
        }
        const { next, waypoint } = stepAlong(st.pos, tRoute, st.waypoint)
        allStateRef.current[t.id] = { pos: next, waypoint }
        const zones = allNeighborhoods.filter((n) => n.city === tCity)
        writePosition(t, next[0], next[1], tCity, zones, { status: 'en_ruta' }).catch((e) => {
          fail(e)
          setSimulatingAll(false)
        })
      }
      setLastWrite(new Date().toLocaleTimeString('es-CO'))
    }, TICK_ALL_MS)
    return () => window.clearInterval(id)
  }, [simulatingAll, myTrucks.length])

  async function toggleSimulation() {
    if (simulating) {
      setSimulating(false)
      return
    }
    if (!myTruck) return
    setSimulatingAll(false)
    // Si el camión está en otra ciudad, se traslada al inicio de la ruta de la ciudad activa
    if (cityOf(myTruck) !== city.id || !insideCity(myTruck.location.latitude, myTruck.location.longitude, city)) {
      const start = route[0] ?? [city.lat, city.lng]
      try {
        await moveTruck(start[0], start[1], { status: 'en_ruta' })
      } catch (e) {
        fail(e)
        return
      }
      waypointRef.current = 1
      setMessage(`Camión ${myTruck.plate} trasladado a ${city.name} para iniciar la ruta.`)
    }
    setSimulating(true)
  }

  async function createTruckDoc(p: string, type: WasteType, cityId: string) {
    if (!user) throw new Error('Sesión no válida')
    const c = getCity(cityId)
    const start = routeFor(cityId)[0] ?? [c.lat, c.lng]
    return addDoc(collection(db, 'trucks'), {
      plate: p,
      wasteType: type,
      status: 'detenido',
      location: new GeoPoint(start[0], start[1]),
      city: cityId,
      driverId: user.uid,
      driverEmail: user.email,
      neighborhoodId: null,
      updatedAt: serverTimestamp(),
    })
  }

  async function createTruck() {
    const cleanPlate = plate.trim().toUpperCase()
    if (!/^[A-Z]{3}[0-9]{3}$/.test(cleanPlate)) {
      setMessage('La placa debe tener el formato ABC123.')
      return
    }
    try {
      const ref = await createTruckDoc(cleanPlate, wasteType, city.id)
      setSelectedId(ref.id)
      setPlate('')
      setMessage(`Camión ${cleanPlate} registrado en ${city.name}.`)
    } catch (e) {
      fail(e)
    }
  }

  async function createDemoTrucks() {
    setBusy(true)
    try {
      const existing = new Set(myTrucks.map((t) => t.plate))
      const missing = DEMO_TRUCKS.filter((d) => !existing.has(d.plate))
      await Promise.all(missing.map((d) => createTruckDoc(d.plate, d.wasteType, d.city)))
      setMessage(
        missing.length
          ? `Se crearon ${missing.length} camiones demo: ${missing.map((d) => `${d.plate} (${getCity(d.city).name})`).join(', ')}.`
          : 'Ya tienes los camiones demo de Popayán, Cali, Bogotá y Medellín.',
      )
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function seed() {
    setBusy(true)
    try {
      const n = await seedBaseData(city.id)
      setMessage(n > 0 ? `Se cargaron ${n} registros de ejemplo en ${city.name}.` : `Los datos de ${city.name} ya estaban completos.`)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(status: TruckStatus) {
    if (!myTruck) return
    if (status !== 'en_ruta') setSimulating(false)
    await updateDoc(doc(db, 'trucks', myTruck.id), { status, updatedAt: serverTimestamp() }).catch(fail)
  }

  async function removeTruck() {
    if (!myTruck || !confirm(`¿Eliminar el camión ${myTruck.plate}?`)) return
    setSimulating(false)
    await deleteDoc(doc(db, 'trucks', myTruck.id)).catch(fail)
    setSelectedId(null)
  }

  async function takeReport(r: Report) {
    if (!user) return
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        status: 'en_ruta',
        assignedTo: user.uid,
        assignedAt: serverTimestamp(),
      })
      setMessage('Reporte marcado «En ruta»: el ciudadano ya ve que vas en camino.')
    } catch (e) {
      fail(e)
    }
  }

  async function attendReport(r: Report) {
    if (!user) return
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        status: 'atendido',
        attendedBy: user.uid,
        attendedAt: serverTimestamp(),
      })
      setMessage('Reporte marcado como recolectado.')
    } catch (e) {
      fail(e)
    }
  }

  const seedComplete = stored >= city.zones.length
  const truckCity = myTruck ? getCity(cityOf(myTruck)) : null

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* Barra de ciudad */}
      <section className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <CitySelect onChange={onCityChange} />
          <p className="text-sm text-slate-600">
            <MapPinned className="mr-1 inline h-4 w-4 text-eco-600" />
            {trucks.length} camión(es) y {reports.length} reporte(s) abiertos en {city.name}
          </p>
        </div>
        <button
          onClick={createDemoTrucks}
          disabled={busy}
          className={`${btn} border-2 border-eco-600 text-eco-700 hover:bg-eco-50 disabled:opacity-60`}
        >
          <TruckIcon className="h-4 w-4" /> Crear camiones demo (4 ciudades)
        </button>
      </section>

      {/* Panel de controles: altura automática, sin scroll interno */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Mis camiones y datos */}
        <div className={card}>
          <h2 className={cardTitle}>
            <TruckIcon className="h-4 w-4" /> Mis camiones ({myTrucks.length})
          </h2>
          {myTrucks.length > 0 ? (
            <select
              value={myTruck?.id ?? ''}
              onChange={(e) => {
                setSimulating(false)
                setSelectedId(e.target.value)
                const t = myTrucks.find((x) => x.id === e.target.value)
                if (t && cityOf(t) !== city.id) setCityId(cityOf(t))
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {myTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} · {getCity(cityOf(t)).name} · {t.wasteType}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500">Aún no tienes camiones. Registra uno o crea los camiones demo.</p>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Barrios de {city.name} en la base: <strong>{stored}</strong> / {city.zones.length}
          </div>
          <button
            onClick={seed}
            disabled={busy}
            className={`${btn} w-full ${
              seedComplete ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-amber-500 text-white hover:bg-amber-600'
            } disabled:opacity-60`}
          >
            <Database className="h-4 w-4" />
            {busy ? 'Procesando…' : seedComplete ? `Verificar datos de ${city.name}` : `Cargar datos de ${city.name}`}
          </button>
        </div>

        {/* 2. Registrar camión */}
        <div className={card}>
          <h2 className={cardTitle}>
            <Plus className="h-4 w-4" /> Registrar camión
          </h2>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Placa (ej. SPN123)"
            maxLength={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
          />
          <select
            value={wasteType}
            onChange={(e) => setWasteType(e.target.value as WasteType)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="ordinario">Residuo ordinario</option>
            <option value="reciclable">Residuo reciclable</option>
          </select>
          <p className="text-xs text-slate-500">
            Ciudad: <strong>{city.name}</strong> (cámbiala con el selector de arriba)
          </p>
          <button onClick={createTruck} className={`${btn} w-full bg-eco-600 text-white hover:bg-eco-700`}>
            <Plus className="h-4 w-4" /> Registrar en {city.name}
          </button>
        </div>

        {/* 3. Simulador */}
        <div className={card}>
          <h2 className={cardTitle}>
            <Navigation className="h-4 w-4" /> Simulador {myTruck && `· ${myTruck.plate}`}
          </h2>
          {myTruck ? (
            <>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(STATUS_LABEL) as TruckStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`rounded-md px-1 py-1.5 text-xs font-medium ${
                      myTruck.status === s ? 'bg-eco-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <button
                onClick={toggleSimulation}
                disabled={route.length < 2}
                className={`${btn} w-full text-white disabled:opacity-50 ${
                  simulating ? 'bg-red-500 hover:bg-red-600' : 'bg-eco-600 hover:bg-eco-700'
                }`}
              >
                {simulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {simulating ? 'Detener recorrido' : `Iniciar ruta en ${city.name}`}
              </button>
              <button
                onClick={() => {
                  setSimulating(false)
                  allStateRef.current = {}
                  setSimulatingAll((v) => !v)
                }}
                disabled={myTrucks.length < 2}
                className={`${btn} w-full py-1.5 disabled:opacity-50 ${
                  simulatingAll ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Zap className="h-4 w-4" />
                {simulatingAll ? 'Detener todos' : 'Mover todos mis camiones'}
              </button>
              <p className="flex items-start gap-2 text-xs text-slate-600">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
                O toca el mapa para mover el camión a ese punto de {city.name}.
              </p>
              <div className="grid grid-cols-2 gap-x-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                <span>lat {myTruck.location.latitude.toFixed(5)}</span>
                <span>lng {myTruck.location.longitude.toFixed(5)}</span>
                <span className="col-span-2 truncate">ciudad: {truckCity?.name}</span>
                <span className="col-span-2 truncate">
                  barrio: {allNeighborhoods.find((n) => n.id === myTruck.neighborhoodId)?.name ?? '—'}
                </span>
                <span className="col-span-2">última escritura: {lastWrite ?? '—'}</span>
              </div>
              <button onClick={removeTruck} className={`${btn} w-full py-1.5 text-red-600 hover:bg-red-50`}>
                <Trash className="h-4 w-4" /> Eliminar camión
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Registra o selecciona un camión para activar el simulador.</p>
          )}
        </div>

        {/* 4. Reportes ciudadanos de la ciudad activa */}
        <div className={card}>
          <h2 className={cardTitle}>
            <AlertTriangle className="h-4 w-4 text-orange-600" /> Reportes en {city.name} ({reports.length})
          </h2>
          {reports.length === 0 && <p className="text-sm text-slate-500">No hay reportes abiertos. ¡Todo limpio!</p>}
          <ul className="space-y-2">
            {reportsByDistance.slice(0, 5).map(({ r, meters }) => (
              <li key={r.id} className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1 font-medium text-orange-900">
                    {r.type === 'recoleccion_prioritaria' ? (
                      <Siren className="h-4 w-4 text-red-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    {REPORT_LABEL[r.type]}
                  </p>
                  <span className="whitespace-nowrap text-xs font-semibold text-orange-800">{formatDistance(meters)}</span>
                </div>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STAGE_BADGE[reportStage(r)]}`}
                >
                  {STAGE_LABEL[reportStage(r)]}
                </span>
                <p className="text-xs text-orange-800/80">
                  {allNeighborhoods.find((n) => n.id === r.neighborhoodId)?.name ?? 'Sin barrio'} ·{' '}
                  {timeAgo(r.createdAt?.toMillis(), now)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setFocus([r.location.latitude, r.location.longitude])}
                    className="rounded-md bg-white px-2 py-1 text-xs font-medium shadow-sm"
                  >
                    Ver en mapa
                  </button>
                  {reportStage(r) === 'pendiente' && (
                    <button
                      onClick={() => takeReport(r)}
                      className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white"
                    >
                      <Navigation className="h-3 w-3" /> Voy en camino
                    </button>
                  )}
                  <button
                    onClick={() => attendReport(r)}
                    className="flex items-center gap-1 rounded-md bg-eco-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Recolectado
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {reports.length > 5 && <p className="text-xs text-slate-500">+{reports.length - 5} más en el mapa</p>}
        </div>
      </section>

      {(message || error) && (
        <p className="rounded-lg bg-white p-3 text-sm text-slate-700 shadow">{error ?? message}</p>
      )}

      <section className="h-[60vh] min-h-[380px] overflow-hidden rounded-xl shadow">
        <MapaCiudad
          city={city}
          trucks={trucks}
          neighborhoods={neighborhoods}
          reports={reports}
          highlightTruckId={myTruck?.id}
          focus={focus}
          picking={!!myTruck}
          onMapClick={(lat, lng) => {
            setSimulating(false)
            setSimulatingAll(false)
            moveTruck(lat, lng).catch(fail)
          }}
          renderReportActions={(r) => (
            <span style={{ marginTop: 6, display: 'flex', gap: 4 }}>
              {reportStage(r) === 'pendiente' && (
                <button
                  onClick={() => takeReport(r)}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Voy en camino
                </button>
              )}
              <button
                onClick={() => attendReport(r)}
                className="rounded bg-eco-600 px-2 py-1 text-xs font-semibold text-white"
              >
                Recolectado
              </button>
            </span>
          )}
        />
      </section>
    </div>
  )
}
