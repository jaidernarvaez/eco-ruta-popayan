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
  MousePointerClick,
  Navigation,
  Pause,
  Play,
  Plus,
  Siren,
  Trash,
  Truck as TruckIcon,
} from 'lucide-react'
import MapaPopayan, { POPAYAN_CENTRO } from './MapaPopayan'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useNeighborhoods, useOpenReports, useTrucks } from '../hooks/useFirestoreData'
import { timeAgo, useNow } from '../hooks/useNow'
import { NEIGHBORHOODS_SEED, seedBaseData } from '../data/seed'
import { distanceMeters, formatDistance, insidePopayan, nearestNeighborhood } from '../lib/geo'
import { REPORT_LABEL, STATUS_LABEL, type Report, type TruckStatus, type WasteType } from '../types'

const STEP_DEG = 0.0007 // ~78 m por paso
const TICK_MS = 2000 // una escritura en Firestore cada 2 s

const card = 'rounded-xl bg-white p-4 shadow space-y-3'
const cardTitle = 'flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500'
const btn = 'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'

export default function DriverView() {
  const { user } = useAuth()
  const { items: trucks, error } = useTrucks()
  const { items: neighborhoods, stored } = useNeighborhoods()
  const { items: reports } = useOpenReports()
  const now = useNow(15000)

  const myTrucks = useMemo(() => trucks.filter((t) => t.driverId === user?.uid), [trucks, user])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const myTruck = myTrucks.find((t) => t.id === selectedId) ?? myTrucks[0] ?? null

  const [plate, setPlate] = useState('')
  const [wasteType, setWasteType] = useState<WasteType>('ordinario')
  const [message, setMessage] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [lastWrite, setLastWrite] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [focus, setFocus] = useState<[number, number] | null>(null)

  // Ruta de simulación: recorre los centros de los barrios en orden
  const route = useMemo(
    () => neighborhoods.map((n) => [n.center.latitude, n.center.longitude] as [number, number]),
    [neighborhoods],
  )
  const posRef = useRef<[number, number] | null>(null)
  const waypointRef = useRef(0)

  useEffect(() => {
    if (myTruck) posRef.current = [myTruck.location.latitude, myTruck.location.longitude]
  }, [myTruck])

  // Reportes ordenados por cercanía al camión seleccionado
  const reportsByDistance = useMemo(() => {
    const from = myTruck ? [myTruck.location.latitude, myTruck.location.longitude] : POPAYAN_CENTRO
    return reports
      .map((r) => ({ r, meters: distanceMeters(from[0], from[1], r.location.latitude, r.location.longitude) }))
      .sort((a, b) => {
        // Primero las solicitudes prioritarias, luego por distancia
        const pa = a.r.type === 'recoleccion_prioritaria' ? 0 : 1
        const pb = b.r.type === 'recoleccion_prioritaria' ? 0 : 1
        return pa - pb || a.meters - b.meters
      })
  }, [reports, myTruck])

  async function moveTruck(lat: number, lng: number, extra: Record<string, unknown> = {}) {
    if (!myTruck) {
      setMessage('Primero registra o selecciona un camión.')
      return
    }
    if (!insidePopayan(lat, lng)) {
      setMessage('Esa ubicación está fuera del área de Popayán.')
      return
    }
    await updateDoc(doc(db, 'trucks', myTruck.id), {
      location: new GeoPoint(lat, lng),
      neighborhoodId: nearestNeighborhood(lat, lng, neighborhoods, 600),
      updatedAt: serverTimestamp(),
      ...extra,
    })
    posRef.current = [lat, lng]
    setLastWrite(new Date().toLocaleTimeString('es-CO'))
  }

  // Simulación automática
  useEffect(() => {
    if (!simulating || !myTruck || route.length < 2) return
    const id = window.setInterval(() => {
      const pos = posRef.current
      if (!pos) return
      const target = route[waypointRef.current % route.length]
      const dLat = target[0] - pos[0]
      const dLng = target[1] - pos[1]
      const dist = Math.hypot(dLat, dLng)
      let next: [number, number]
      if (dist <= STEP_DEG) {
        next = target
        waypointRef.current += 1
      } else {
        next = [pos[0] + (dLat / dist) * STEP_DEG, pos[1] + (dLng / dist) * STEP_DEG]
      }
      moveTruck(next[0], next[1], { status: 'en_ruta' }).catch((e) => {
        setMessage(e instanceof Error ? e.message : String(e))
        setSimulating(false)
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [simulating, myTruck?.id, route])

  async function createTruck() {
    if (!user) return
    const cleanPlate = plate.trim().toUpperCase()
    if (!/^[A-Z]{3}[0-9]{3}$/.test(cleanPlate)) {
      setMessage('La placa debe tener el formato ABC123.')
      return
    }
    try {
      const start = route[0] ?? POPAYAN_CENTRO
      const ref = await addDoc(collection(db, 'trucks'), {
        plate: cleanPlate,
        wasteType,
        status: 'detenido',
        location: new GeoPoint(start[0], start[1]),
        driverId: user.uid,
        driverEmail: user.email,
        neighborhoodId: null,
        updatedAt: serverTimestamp(),
      })
      setSelectedId(ref.id)
      setPlate('')
      setMessage(`Camión ${cleanPlate} registrado.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function seed() {
    setSeeding(true)
    try {
      const n = await seedBaseData()
      setMessage(n > 0 ? `Se cargaron ${n} registros de ejemplo (barrios y horarios).` : 'Los datos de ejemplo ya estaban completos.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setSeeding(false)
    }
  }

  async function setStatus(status: TruckStatus) {
    if (!myTruck) return
    if (status !== 'en_ruta') setSimulating(false)
    await updateDoc(doc(db, 'trucks', myTruck.id), { status, updatedAt: serverTimestamp() })
  }

  async function removeTruck() {
    if (!myTruck || !confirm(`¿Eliminar el camión ${myTruck.plate}?`)) return
    setSimulating(false)
    await deleteDoc(doc(db, 'trucks', myTruck.id))
    setSelectedId(null)
  }

  async function attendReport(r: Report) {
    if (!user) return
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        status: 'atendido',
        attendedBy: user.uid,
        attendedAt: serverTimestamp(),
      })
      setMessage(`Reporte marcado como atendido.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  const seedComplete = stored >= NEIGHBORHOODS_SEED.length

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* Panel de controles: altura automática, sin scroll interno */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Datos y mis camiones */}
        <div className={card}>
          <h2 className={cardTitle}>
            <TruckIcon className="h-4 w-4" /> Mis camiones
          </h2>
          {myTrucks.length > 0 ? (
            <select
              value={myTruck?.id ?? ''}
              onChange={(e) => {
                setSimulating(false)
                setSelectedId(e.target.value)
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {myTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} · {t.wasteType}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500">Aún no tienes camiones. Registra uno para simular.</p>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              Barrios en la base: <strong>{stored}</strong> / {NEIGHBORHOODS_SEED.length}
            </p>
          </div>
          <button
            onClick={seed}
            disabled={seeding}
            className={`${btn} w-full ${
              seedComplete ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-amber-500 text-white hover:bg-amber-600'
            } disabled:opacity-60`}
          >
            <Database className="h-4 w-4" />
            {seeding ? 'Cargando…' : seedComplete ? 'Verificar datos de ejemplo' : 'Cargar datos de ejemplo'}
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
          <button onClick={createTruck} className={`${btn} w-full bg-eco-600 text-white hover:bg-eco-700`}>
            <Plus className="h-4 w-4" /> Registrar
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
                onClick={() => setSimulating((v) => !v)}
                disabled={route.length < 2}
                className={`${btn} w-full text-white disabled:opacity-50 ${
                  simulating ? 'bg-red-500 hover:bg-red-600' : 'bg-eco-600 hover:bg-eco-700'
                }`}
              >
                {simulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {simulating ? 'Detener recorrido' : 'Iniciar recorrido automático'}
              </button>
              <p className="flex items-start gap-2 text-xs text-slate-600">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
                O toca el mapa para mover el camión a ese punto.
              </p>
              <div className="grid grid-cols-2 gap-x-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                <span>lat {myTruck.location.latitude.toFixed(5)}</span>
                <span>lng {myTruck.location.longitude.toFixed(5)}</span>
                <span className="col-span-2 truncate">
                  barrio: {neighborhoods.find((n) => n.id === myTruck.neighborhoodId)?.name ?? '—'}
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

        {/* 4. Reportes ciudadanos */}
        <div className={card}>
          <h2 className={cardTitle}>
            <AlertTriangle className="h-4 w-4 text-orange-600" /> Reportes ciudadanos ({reports.length})
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
                <p className="text-xs text-orange-800/80">
                  {neighborhoods.find((n) => n.id === r.neighborhoodId)?.name ?? 'Sin barrio'} ·{' '}
                  {timeAgo(r.createdAt?.toMillis(), now)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setFocus([r.location.latitude, r.location.longitude])}
                    className="rounded-md bg-white px-2 py-1 text-xs font-medium shadow-sm"
                  >
                    Ver en mapa
                  </button>
                  <button
                    onClick={() => attendReport(r)}
                    className="flex items-center gap-1 rounded-md bg-eco-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Atendido
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
        <MapaPopayan
          trucks={trucks}
          neighborhoods={neighborhoods}
          reports={reports}
          highlightTruckId={myTruck?.id}
          focus={focus}
          picking={!!myTruck}
          onMapClick={(lat, lng) => {
            setSimulating(false)
            moveTruck(lat, lng).catch((e) => setMessage(e instanceof Error ? e.message : String(e)))
          }}
          renderReportActions={(r) => (
            <button
              onClick={() => attendReport(r)}
              style={{ marginTop: 6, display: 'block' }}
              className="rounded bg-eco-600 px-2 py-1 text-xs font-semibold text-white"
            >
              Marcar como atendido
            </button>
          )}
        />
      </section>
    </div>
  )
}
